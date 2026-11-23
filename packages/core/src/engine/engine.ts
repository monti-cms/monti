import {
	type AbortableQueryOptions,
	type CompiledQuery,
	type Kysely,
	type PluginTransformQueryArgs,
	type PluginTransformResultArgs,
	type QueryResult,
	type RootOperationNode,
	sql,
	type Transaction,
	type UnknownRow,
} from "kysely";
import type { Database } from "../db/types";
import { uniqueConflictMessage } from "../db/unique-conflicts";
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
	/** Operation 호출 하나를 실행한다: 콜백 안에서는 콜백이 끝난 뒤 시작하면 거절하고, 끝날 때 남아 있었는지 센다. */
	call<T>(work: () => Promise<T>): Promise<T>;
	/** 트랜잭션을 중단시킨 DB 오류(고유 제약 위반은 `CONFLICT`로 바꾼 것)를 받는다: 콜백이 잡아도 호출 전체를 실패시킨다. */
	abort?(error: unknown): void;
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

/**
 * `fn`을 자기 단계를 가진 새 트랜잭션에서 실행한다. 커밋 전에 단계의 파일 변경을 임시 파일로 준비해, 쓸 수 없으면
 * 트랜잭션째 롤백한다. `beforeCommit`은 그 뒤 커밋 직전에 불러, 던지면 롤백한다. 커밋한 뒤 파일을 바꾸고 공유 상태에 반영한다.
 */
async function committed<T>(
	db: Kysely<Database>,
	state: State,
	fn: (trx: Transaction<Database>, stage: Stage) => Promise<T>,
	beforeCommit?: () => void,
): Promise<T> {
	const stage = state.stage();
	try {
		const result = await db.transaction().execute(async (trx) => {
			const value = await fn(trx, stage);
			await stage.prepare();
			beforeCommit?.();
			return value;
		});
		await stage.commit();
		return result;
	} finally {
		await stage.release();
	}
}

function directRunner(db: Kysely<Database>, state: State, emit: (event: MontiEvent) => void): Runner {
	function context(): ReadContext {
		return state.readContext(db);
	}
	function write(run: (ctx: WriteContext) => Promise<unknown>): Promise<unknown> {
		return committed(db, state, (trx, stage) => run(stage.context(trx)));
	}
	function call<T>(work: () => Promise<T>): Promise<T> {
		return work();
	}
	return { context, write, emit, call };
}

function callbackRunner(
	trx: Transaction<Database>,
	stage: Stage,
	queue: MontiEvent[],
	aborts: unknown[],
	work: CallbackWork,
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
	function abort(error: unknown): void {
		aborts.push(error);
	}
	async function call<T>(run: () => Promise<T>): Promise<T> {
		work.open();
		return work.track(run);
	}
	return { context, write, emit, abort, call };
}

/** 콜백이 기다리지 않은 작업이 있어 호출 전체를 실패시킬 때 던지는 오류의 메시지. */
const UNAWAITED = "콜백이 기다리지 않은 작업이 있어 아무것도 저장하지 않았다: 콜백 안의 작업은 모두 기다려야 한다";

/** 콜백이 시작한 작업(`tx`의 Operation 호출과 `trx`의 쿼리)의 상태. */
interface CallbackWork {
	/** 콜백이 끝났으면 기다리지 않은 작업으로 기록하고 던진다. 작업을 시작하기 직전에 부른다. */
	open(): void;
	/** 작업 하나를 실행하는 동안 진행 중으로 센다. 성공하든 실패하든 끝나면 뺀다. */
	track<T>(run: () => Promise<T>): Promise<T>;
	/** 콜백의 Promise가 끝났다: 이때 진행 중인 작업이 있으면 기다리지 않은 것이다. 이 뒤의 `open`은 던진다. */
	settle(): void;
	/** 기다리지 않은 작업이 있었으면 던진다. 커밋·롤백 직전에 부른다. */
	assertAwaited(): void;
}

/**
 * 콜백이 기다리지 않은 작업을 찾는다. 콜백의 Promise가 끝날 때 진행 중인 작업이 있거나, 그 뒤 커밋·롤백 전에 작업이
 * 시작되면 그 작업은 콜백이 기다리지 않은 것이다. 이때 호출 전체를 실패시켜, 쓰기 Operation이 여러 문장 가운데 일부만
 * 저장되거나 콜백이 끝난 뒤의 쿼리가 함께 커밋되지 않게 한다.
 */
function callbackWork(): CallbackWork {
	let running = 0;
	let settled = false;
	let unawaited = false;
	function open(): void {
		if (!settled) return;
		unawaited = true;
		throw new Error("콜백이 끝난 뒤에는 트랜잭션을 쓸 수 없다: 콜백 안의 작업은 모두 기다려야 한다");
	}
	async function track<T>(run: () => Promise<T>): Promise<T> {
		running += 1;
		try {
			return await run();
		} finally {
			running -= 1;
		}
	}
	function settle(): void {
		settled = true;
		if (running > 0) unawaited = true;
	}
	function assertAwaited(): void {
		if (unawaited) throw new Error(UNAWAITED);
	}
	return { open, track, settle, assertAwaited };
}

/**
 * 콜백의 값, 또는 콜백의 쓰기가 낸 첫 DB 오류(고유 제약 위반은 `CONFLICT`). 콜백이 그 오류를 잡고 정상 반환해도, 잡은 뒤
 * 이어간 DB 호출이 중단된 트랜잭션 오류(`25P02`)로 실패해도 그 첫 오류로 실패한다. 콜백의 Promise가 끝나면 곧바로 콜백의
 * 작업을 마감하고(`settle`), 콜백이 정상 반환했으면 `trx`가 중단되지 않았는지도 확인한다. 기다리지 않은 작업은 호출한
 * 쪽이 커밋·롤백 직전에 확인한다.
 */
async function runSettled<T>(
	run: () => Promise<T>,
	aborts: unknown[],
	trx: Transaction<Database>,
	work: CallbackWork,
): Promise<T> {
	const result = await run().then(
		(value) => ({ value }),
		(error: unknown) => ({ error }),
	);
	work.settle();
	if (aborts.length > 0) throw aborts[0];
	if ("error" in result) throw result.error;
	await assertNotAborted(trx);
	return result.value;
}

/**
 * 콜백에 넘길 `trx`. 콜백이 끝난 뒤 시작한 쿼리는 실행 전에 던지고 기다리지 않은 작업으로 기록한다: 콜백이 기다리지
 * 않았거나 바깥에 붙잡아 둔 `trx`·`tx`의 쿼리가 확인 조회와 커밋 사이에, 커밋 뒤 자동 커밋으로, 또는 같은 연결을 이어 쓴
 * 다른 요청의 트랜잭션 안에서 실행되지 않게 한다. 실행 중인 쿼리는 성공하든 실패하든 끝날 때까지 센다: Kysely 플러그인의
 * `transformResult`는 실패한 쿼리에 불리지 않으므로, 플러그인을 더해 갈라진 이 `trx`의 실행기에서 `executeQuery`를 감싼다.
 * 엔진의 확인 조회와 커밋은 원래 `trx`를 쓴다.
 */
function trackedTrx(trx: Transaction<Database>, work: CallbackWork): Transaction<Database> {
	function transformQuery({ node }: PluginTransformQueryArgs): RootOperationNode {
		work.open();
		return node;
	}
	async function transformResult({ result }: PluginTransformResultArgs): Promise<QueryResult<UnknownRow>> {
		return result;
	}
	const tracked = trx.withPlugin({ transformQuery, transformResult });
	const executor = tracked.getExecutor();
	const executeQuery = executor.executeQuery.bind(executor);
	executor.executeQuery = <R>(query: CompiledQuery<R>, options?: AbortableQueryOptions) =>
		work.track(() => executeQuery(query, options));
	return tracked;
}

/**
 * 콜백이 `trx`로 직접 실행한 쿼리의 DB 오류를 잡고 정상 반환했으면 던진다: 중단된 트랜잭션에서는 이 조회가 `25P02`로
 * 실패하고, 그 오류를 그대로 던진다. 커밋하지 않는 `dryRun`은 이 확인이 없으면 저장되지 않을 쓰기를 성공으로 알린다.
 * `transaction`은 Kysely가 `COMMIT`의 `ROLLBACK` 응답을 `AbortedTransactionError`로 알리지만, 같은 확인으로 `dryRun`과 같은
 * 오류를 내고 단계의 파일을 준비하기 전에 실패한다.
 */
async function assertNotAborted(trx: Transaction<Database>): Promise<void> {
	await sql`select 1`.execute(trx);
}

/**
 * 콜백의 호출들은 한 트랜잭션을 공유하고, 콜백은 그 트랜잭션의 DB(`trx`)도 받는다. 커밋된 뒤 쌓인 이벤트를 호출 순서대로
 * 통지한다.
 */
function transactionOf<R extends ResourceTree>(
	db: Kysely<Database>,
	state: State,
	tree: ResourceTree,
	emit: (event: MontiEvent) => void,
) {
	return async function transaction<T>(fn: (tx: MontiClient<R>, trx: Transaction<Database>) => Promise<T>): Promise<T> {
		const queue: MontiEvent[] = [];
		const aborts: unknown[] = [];
		const work = callbackWork();
		const result = await committed(
			db,
			state,
			async (trx, stage) => {
				const tracked = trackedTrx(trx, work);
				const client = buildClient(tree, "", callbackRunner(tracked, stage, queue, aborts, work), true);
				return runSettled(() => fn(client as MontiClient<R>, tracked), aborts, trx, work);
			},
			work.assertAwaited,
		);
		for (const event of queue) emit(event);
		return result;
	};
}

/** `dryRun`이 콜백을 끝낸 뒤 트랜잭션을 되돌리려고 던지는 표시. 바깥으로 나가지 않는다. */
class DryRunRollback extends Error {}

/**
 * 쓰기만 보이는 콜백을 실제와 같이 실행한 뒤 롤백한다. 콜백은 그 트랜잭션의 DB(`trx`)도 받는다. `trx`는 직접 커밋할 수
 * 있는 트랜잭션이 아니라, 엔진이 끝을 정하는 트랜잭션이다. 쌓인 이벤트와 단계는 버린다. 단계의 저장소는 롤백으로 되돌릴
 * 수 없는 티켓 발급(`ticket`)과 삭제(`remove`)를 `BAD_REQUEST`로 거절한다. 롤백이 실패해도 단계의 차례는 넘긴다.
 */
function dryRunOf<R extends ResourceTree>(db: Kysely<Database>, state: State, tree: ResourceTree) {
	return async function dryRun<T>(fn: (tx: MontiWriteClient<R>, trx: Transaction<Database>) => Promise<T>): Promise<T> {
		const stage = state.stage(true);
		const aborts: unknown[] = [];
		const work = callbackWork();
		const outcome: { value?: T } = {};
		try {
			await db.transaction().execute(async (trx) => {
				const tracked = trackedTrx(trx, work);
				const client = buildClient(tree, "", callbackRunner(tracked, stage, [], aborts, work), false);
				outcome.value = await runSettled(() => fn(client as MontiWriteClient<R>, tracked), aborts, trx, work);
				work.assertAwaited();
				throw new DryRunRollback();
			});
		} catch (error) {
			if (!(error instanceof DryRunRollback)) throw error;
		} finally {
			await stage.release();
		}
		return outcome.value as T;
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
		return runner.call(() => execute(operation, path, input, runner));
	};
}

/** 비밀번호·세션 토큰·외부 API 키 원문이 오가는 리소스: 이 리소스들의 쓰기는 구독자에게 통지하지 않는다. */
const SILENT_RESOURCES = ["admin", "session", "keys"];

/** 서명된 업로드 URL·헤더를 돌려주는 쓰기: 구독자에게 통지하지 않는다. */
const SILENT_OPERATIONS = ["media.startUpload"];

/** `path`의 Operation이 통지하지 않는 리소스에 속하거나 통지하지 않는 쓰기인지. */
function isSilent(path: string): boolean {
	return SILENT_RESOURCES.includes(path.split(".")[0]) || SILENT_OPERATIONS.includes(path);
}

/**
 * 구독자마다 사본으로 보낼 이벤트가 복사되는지 확인한다. 함수처럼 복사할 수 없는 값이 들어 있으면 커밋 전에 오류를 던져,
 * 이벤트가 조용히 빠지는 대신 쓰기를 만든 쪽이 바로 알게 한다.
 */
function assertCloneable(event: MontiEvent): void {
	try {
		structuredClone(event);
	} catch (cause) {
		throw new Error(`${event.operation}의 입력이나 결과에 복사할 수 없는 값(함수 등)이 있어 이벤트로 보낼 수 없다`, {
			cause,
		});
	}
}

/**
 * 읽기는 러너의 DB에서 실행한다. 쓰기는 러너의 트랜잭션에서 실행하고 그 이벤트를 러너에 넘기되, `admin`·`session`·`keys`
 * 리소스의 쓰기와 `media.startUpload`는 이벤트를 넘기지 않는다. 넘길 이벤트가 복사되지 않으면 커밋하지 않는다.
 */
async function execute(operation: Operation, path: string, raw: unknown, runner: Runner): Promise<unknown> {
	const input = parseInput(operation, raw);
	if (operation.kind === "read") return operation.run(input, runner.context());
	const silent = isSilent(path);
	const output = await runner
		.write(async (ctx) => {
			const result = await operation.run(input, ctx);
			if (!silent) assertCloneable({ operation: path, input, output: result });
			return result;
		})
		.catch((error) => asAborted(error, runner));
	if (!silent) runner.emit({ operation: path, input, output });
	return output;
}

/** PostgreSQL 오류의 SQLSTATE: 다섯 글자의 숫자·대문자. */
const SQLSTATE = /^[0-9A-Z]{5}$/;

/** PostgreSQL이 보낸 오류인지: SQLSTATE `code`와 `severity`를 함께 가진다. `EPERM` 같은 Node 오류에는 `severity`가 없다. */
function isDatabaseError(error: unknown): error is { code: string; constraint?: unknown } {
	if (typeof error !== "object" || error === null || !("code" in error) || !("severity" in error)) return false;
	return typeof error.code === "string" && SQLSTATE.test(error.code);
}

/**
 * PostgreSQL 오류는 트랜잭션을 중단시키므로 러너에 넘긴다. 고유 제약 위반(`23505`)은 어긴 제약의 이름에 맞는 메시지의
 * `CONFLICT`로 바꿔 넘기고 던진다. 그 밖의 오류는 그대로 던진다: 리소스가 직접 던진 `CONFLICT`를 포함해 아무것도 중단시키지 않는다.
 */
function asAborted(error: unknown, runner: Runner): never {
	if (!isDatabaseError(error)) throw error;
	const aborted = error.code === "23505" ? new MontiError("CONFLICT", uniqueConflictMessage(error.constraint)) : error;
	runner.abort?.(aborted);
	throw aborted;
}

/** A call without an input is parsed as given first, then as `{}` when the schema does not accept `undefined`. */
function parseInput(operation: Operation, raw: unknown): unknown {
	const parsed = operation.input.safeParse(raw);
	const result = !parsed.success && raw === undefined ? operation.input.safeParse({}) : parsed;
	if (!result.success) throw new MontiError("BAD_REQUEST", result.error.message, result.error.issues);
	return result.data;
}
