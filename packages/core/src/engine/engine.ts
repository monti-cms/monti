import type { Kysely, Transaction } from "kysely";
import type { Database } from "../db/types";
import { MontiError } from "./errors";
import { createEvents } from "./events";
import { isOperation } from "./operation";
import { withPlugins } from "./plugins";
import { specsOf } from "./spec";
import { createState } from "./state";
import type {
	Monti,
	MontiClient,
	MontiEvent,
	MontiState,
	MontiWriteClient,
	Operation,
	OperationSpec,
	Plugin,
	ReadContext,
	ResourceTree,
	Stage,
	WriteContext,
} from "./types";

type State = ReturnType<typeof createState>;

/** How the calls of one client run: a direct call, a `transaction` callback or a `dryRun` callback. */
interface Runner {
	/** What a read's `run` gets. */
	context(): ReadContext;
	/** Runs a write's `run` in a transaction: a new one for a direct call, the callback's own one inside a callback. */
	write(run: (ctx: WriteContext) => Promise<unknown>): Promise<unknown>;
	/** Takes a write's event: sent at once after a direct call's commit, queued inside a callback. */
	emit(event: MontiEvent): void;
	/** Takes the `CONFLICT` made of a unique violation: a callback keeps it to fail the whole call even when the callback caught it. */
	conflict?(error: MontiError): void;
}

/**
 * 리소스 트리와 플러그인 위의 엔진: `monti.<resource>.<action>(input)`은 그 키 경로의 Operation을 실행한다. 플러그인의
 * Operation은 트리에 더해지고, 플러그인의 `onEvent`는 커밋된 쓰기를 구독한다. `initial`은 Operation이 보는 스키마와
 * 설정, 그리고 그 변경을 쓸 파일이다.
 */
export function createMonti<R extends ResourceTree>(
	db: Kysely<Database>,
	resources: R,
	plugins: Plugin<NoInfer<R>>[] = [],
	initial?: MontiState<NoInfer<R>>,
): Monti<R> {
	const events = createEvents();
	const state = createState((initial ?? {}) as MontiState);
	const tree = withPlugins(resources, plugins);
	const client = buildClient(tree, "", directRunner(db, state, events.emit), true) as MontiClient<R>;
	function spec(): OperationSpec[] {
		return specsOf(tree);
	}
	const monti = Object.assign(client, {
		onEvent: events.onEvent,
		transaction: transactionOf<R>(db, state, tree, events.emit),
		dryRun: dryRunOf<R>(db, state, tree),
		spec,
	});
	for (const plugin of plugins) {
		const { onEvent } = plugin;
		if (onEvent !== undefined) events.onEvent((event) => onEvent(event, { monti }));
	}
	return monti;
}

/** Runs `fn` in a new transaction with a stage of its own; the stage's changes are applied once it commits. */
async function committed<T>(
	db: Kysely<Database>,
	state: State,
	fn: (trx: Transaction<Database>, stage: Stage) => Promise<T>,
): Promise<T> {
	const stage = state.stage();
	const result = await db.transaction().execute((trx) => fn(trx, stage));
	await stage.commit();
	return result;
}

function directRunner(db: Kysely<Database>, state: State, emit: (event: MontiEvent) => void): Runner {
	function context(): ReadContext {
		return state.readContext(db);
	}
	function write(run: (ctx: WriteContext) => Promise<unknown>): Promise<unknown> {
		return committed(db, state, (trx, stage) => run(stage.context(trx)));
	}
	return { context, write, emit };
}

function callbackRunner(
	trx: Transaction<Database>,
	stage: Stage,
	queue: MontiEvent[],
	conflicts: MontiError[],
): Runner {
	function context(): ReadContext {
		return stage.context(trx);
	}
	function write(run: (ctx: WriteContext) => Promise<unknown>): Promise<unknown> {
		return run(stage.context(trx));
	}
	function emit(event: MontiEvent): void {
		queue.push(event);
	}
	function conflict(error: MontiError): void {
		conflicts.push(error);
	}
	return { context, write, emit, conflict };
}

/**
 * 콜백의 값, 또는 콜백의 쓰기가 낸 첫 고유 제약 위반. 콜백이 그 오류를 잡고 정상 반환해도, 잡은 뒤 이어간 DB 호출이
 * 중단된 트랜잭션 오류(`25P02`)로 실패해도 그 `CONFLICT`로 실패한다.
 */
async function runSettled<T>(run: () => Promise<T>, conflicts: MontiError[]): Promise<T> {
	const result = await run().then(
		(value) => ({ value }),
		(error: unknown) => ({ error }),
	);
	const [first] = conflicts;
	if (first !== undefined) throw first;
	if ("error" in result) throw result.error;
	return result.value;
}

/** 콜백의 호출들은 한 트랜잭션을 공유한다. 커밋된 뒤 쌓인 이벤트를 호출 순서대로 통지한다. */
function transactionOf<R extends ResourceTree>(
	db: Kysely<Database>,
	state: State,
	tree: ResourceTree,
	emit: (event: MontiEvent) => void,
) {
	return async function transaction<T>(fn: (tx: MontiClient<R>) => Promise<T>): Promise<T> {
		const queue: MontiEvent[] = [];
		const conflicts: MontiError[] = [];
		const result = await committed(db, state, async (trx, stage) => {
			const client = buildClient(tree, "", callbackRunner(trx, stage, queue, conflicts), true);
			return runSettled(() => fn(client as MontiClient<R>), conflicts);
		});
		for (const event of queue) emit(event);
		return result;
	};
}

/**
 * 쓰기만 보이는 콜백을 실제와 같이 실행한 뒤 롤백한다. 쌓인 이벤트와 단계는 버린다. 단계의 저장소는 롤백으로 되돌릴 수
 * 없는 티켓 발급(`ticket`)과 삭제(`remove`)를 `BAD_REQUEST`로 거절한다.
 */
function dryRunOf<R extends ResourceTree>(db: Kysely<Database>, state: State, tree: ResourceTree) {
	return async function dryRun<T>(fn: (tx: MontiWriteClient<R>) => Promise<T>): Promise<T> {
		const trx = await db.startTransaction().execute();
		const conflicts: MontiError[] = [];
		try {
			const client = buildClient(tree, "", callbackRunner(trx, state.stage(true), [], conflicts), false);
			return await runSettled(() => fn(client as MontiWriteClient<R>), conflicts);
		} finally {
			await trx.rollback().execute();
		}
	};
}

function buildClient(tree: ResourceTree, prefix: string, runner: Runner, reads: boolean): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(tree)
			.filter(([, node]) => reads || !isOperation(node) || node.kind === "write")
			.map(([key, node]) => {
				const path = prefix === "" ? key : `${prefix}.${key}`;
				return [key, isOperation(node) ? bind(node, path, runner) : buildClient(node, path, runner, reads)];
			}),
	);
}

function bind(operation: Operation, path: string, runner: Runner): (input: unknown) => Promise<unknown> {
	return function call(input) {
		return execute(operation, path, input, runner);
	};
}

/** 비밀번호·세션 토큰·외부 API 키 원문이 오가는 리소스: 이 리소스들의 쓰기는 구독자에게 통지하지 않는다. */
const SILENT_RESOURCES = ["admin", "session", "keys"];

/** `path`의 Operation이 통지하지 않는 리소스에 속하는지. */
function isSilent(path: string): boolean {
	return SILENT_RESOURCES.includes(path.split(".")[0]);
}

/**
 * 읽기는 러너의 DB에서 실행한다. 쓰기는 러너의 트랜잭션에서 실행하고 그 이벤트를 러너에 넘기되, `admin`·`session`·`keys`
 * 리소스의 쓰기는 이벤트를 넘기지 않는다.
 */
async function execute(operation: Operation, path: string, raw: unknown, runner: Runner): Promise<unknown> {
	const input = parseInput(operation, raw);
	if (operation.kind === "read") return operation.run(input, runner.context());
	const output = await runner.write((ctx) => operation.run(input, ctx)).catch((error) => asConflict(error, runner));
	if (!isSilent(path)) runner.emit({ operation: path, input, output });
	return output;
}

/**
 * A PostgreSQL unique violation (`23505`) becomes `CONFLICT` and is handed to the runner, as it leaves the transaction
 * aborted. Any other error is thrown as it is, a `CONFLICT` a resource throws itself included: it aborts nothing.
 */
function asConflict(error: unknown, runner: Runner): never {
	if (typeof error === "object" && error !== null && "code" in error && error.code === "23505") {
		const conflict = new MontiError("CONFLICT", "The write would duplicate a unique value");
		runner.conflict?.(conflict);
		throw conflict;
	}
	throw error;
}

/** A call without an input is parsed as given first, then as `{}` when the schema does not accept `undefined`. */
function parseInput(operation: Operation, raw: unknown): unknown {
	const parsed = operation.input.safeParse(raw);
	const result = !parsed.success && raw === undefined ? operation.input.safeParse({}) : parsed;
	if (!result.success) throw new MontiError("BAD_REQUEST", result.error.message, result.error.issues);
	return result.data;
}
