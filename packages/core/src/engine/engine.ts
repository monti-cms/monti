import type { Kysely, Transaction } from "kysely";
import type { Database } from "../db/types";
import { MontiError } from "./errors";
import { createEvents } from "./events";
import { withPlugins } from "./plugins";
import { createState } from "./state";
import type {
	Monti,
	MontiClient,
	MontiEvent,
	MontiState,
	MontiWriteClient,
	Operation,
	Plugin,
	ReadContext,
	ResourceTree,
	Stage,
	WriteContext,
} from "./types";

type State = ReturnType<typeof createState>;

/** How the calls of one client run: a direct call, a `transaction` block or a `dryRun` block. */
interface Runner {
	/** What a read's `run` gets. */
	context(): ReadContext;
	/** Runs a write's `run` in a transaction: a new one for a direct call, the block's own one inside a block. */
	write(run: (ctx: WriteContext) => Promise<unknown>): Promise<unknown>;
	/** Takes a write's event: sent at once after a direct call's commit, queued inside a block. */
	emit(event: MontiEvent): void;
}

/**
 * The engine over a resource tree and its plugins: `monti.<resource>.<action>(input)` runs the operation at that key
 * path. A plugin's operations join the tree and its `onEvent` subscribes to committed writes. `initial` is the schema
 * and config the operations see and the files their changes are written to.
 */
export function createMonti<R extends ResourceTree>(
	db: Kysely<Database>,
	resources: R,
	plugins: Plugin[] = [],
	initial?: MontiState,
): Monti<R> {
	const events = createEvents();
	const state = createState(initial ?? ({} as MontiState));
	const tree = withPlugins(resources, plugins);
	const client = buildClient(tree, "", directRunner(db, state, events.emit), true) as MontiClient<R>;
	const monti = Object.assign(client, {
		onEvent: events.onEvent,
		transaction: transactionOf<R>(db, state, tree, events.emit),
		dryRun: dryRunOf<R>(db, state, tree),
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

function blockRunner(trx: Transaction<Database>, stage: Stage, queue: MontiEvent[]): Runner {
	function context(): ReadContext {
		return stage.context(trx);
	}
	function write(run: (ctx: WriteContext) => Promise<unknown>): Promise<unknown> {
		return run(stage.context(trx));
	}
	function emit(event: MontiEvent): void {
		queue.push(event);
	}
	return { context, write, emit };
}

/** A block's calls share one transaction; once it commits, the queued events are sent in call order. */
function transactionOf<R extends ResourceTree>(
	db: Kysely<Database>,
	state: State,
	tree: ResourceTree,
	emit: (event: MontiEvent) => void,
) {
	return async function transaction<T>(fn: (tx: MontiClient<R>) => Promise<T>): Promise<T> {
		const queue: MontiEvent[] = [];
		const result = await committed(db, state, (trx, stage) =>
			fn(buildClient(tree, "", blockRunner(trx, stage, queue), true) as MontiClient<R>),
		);
		for (const event of queue) emit(event);
		return result;
	};
}

/** A block of writes only, run as they would run and then rolled back; its queued events and its stage are dropped. */
function dryRunOf<R extends ResourceTree>(db: Kysely<Database>, state: State, tree: ResourceTree) {
	return async function dryRun<T>(fn: (tx: MontiWriteClient<R>) => Promise<T>): Promise<T> {
		const trx = await db.startTransaction().execute();
		try {
			return await fn(buildClient(tree, "", blockRunner(trx, state.stage(), []), false) as MontiWriteClient<R>);
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

/** A read runs on the runner's database; a write runs in the runner's transaction and hands its event to the runner. */
async function execute(operation: Operation, path: string, raw: unknown, runner: Runner): Promise<unknown> {
	const input = parseInput(operation, raw);
	if (operation.kind === "read") return operation.run(input, runner.context());
	const output = await runner.write((ctx) => operation.run(input, ctx));
	runner.emit({ operation: path, input, output });
	return output;
}

function parseInput(operation: Operation, raw: unknown): unknown {
	const result = operation.input.safeParse(raw);
	if (!result.success) throw new MontiError("BAD_REQUEST", result.error.message, result.error.issues);
	return result.data;
}

/** Whether a node of the resource tree is an operation rather than a resource holding more nodes. */
function isOperation(node: Operation | ResourceTree): node is Operation {
	return typeof node.run === "function";
}
