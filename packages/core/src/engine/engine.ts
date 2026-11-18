import type { Kysely } from "kysely";
import type { Database } from "../db/types";
import { MontiError } from "./errors";
import { createEvents } from "./events";
import type { Monti, MontiClient, MontiEvent, Operation, ResourceTree } from "./types";

interface Runner {
	db: Kysely<Database>;
	emit: (event: MontiEvent) => void;
}

/** The engine over a resource tree: `monti.<resource>.<action>(input)` runs the operation at that key path. */
export function createMonti<R extends ResourceTree>(db: Kysely<Database>, resources: R): Monti<R> {
	const events = createEvents();
	const client = buildClient(resources, "", { db, emit: events.emit }) as MontiClient<R>;
	return Object.assign(client, { onEvent: events.onEvent });
}

function buildClient(tree: ResourceTree, prefix: string, runner: Runner): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(tree).map(([key, node]) => {
			const path = prefix === "" ? key : `${prefix}.${key}`;
			return [key, isOperation(node) ? bind(node, path, runner) : buildClient(node, path, runner)];
		}),
	);
}

function isOperation(node: Operation | ResourceTree): node is Operation {
	return typeof node.run === "function";
}

function bind(operation: Operation, path: string, runner: Runner): (input: unknown) => Promise<unknown> {
	return function call(input) {
		return execute(operation, path, input, runner);
	};
}

/** A read runs as it is; a write runs in a transaction and, once committed, its event is sent. */
async function execute(operation: Operation, path: string, raw: unknown, runner: Runner): Promise<unknown> {
	const input = parseInput(operation, raw);
	if (operation.kind === "read") return operation.run(input, { db: runner.db });
	const output = await runner.db.transaction().execute((trx) => operation.run(input, { db: trx }));
	runner.emit({ operation: path, input, output });
	return output;
}

function parseInput(operation: Operation, raw: unknown): unknown {
	const result = operation.input.safeParse(raw);
	if (!result.success) throw new MontiError("BAD_REQUEST", result.error.message, result.error.issues);
	return result.data;
}
