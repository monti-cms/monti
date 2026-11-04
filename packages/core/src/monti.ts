import type { Kysely } from "kysely";
import { z } from "zod";
import type { Database } from "./db/schema";
import { type Receiver, sendDeliveries, sendDueDeliveries } from "./engine/deliveries";
import { type Engine, type RunOptions, runRead, runWrite } from "./engine/execute";
import { type ApplyResult, applyProposal, createProposal, proposeItem } from "./engine/proposals";
import { planUndo, undo } from "./engine/undo";
import { UnknownOperationError } from "./errors";
import { type Actor, type AnyOperation, defineOperation, type OperationKind, type Preview } from "./operation";
import type { RecordKind } from "./records";
import type { Schema } from "./schema/define";
import type { SchemaFiles } from "./schema/files";
import { schemaOperations, schemaRecordKinds } from "./schema/operations";
import { createSite } from "./site";

/** A plugin adds operations (and the records and receivers they need) the same way the core does, so they become API routes, tools and commands too. */
export type Plugin = {
	name: string;
	operations?: AnyOperation[];
	recordKinds?: RecordKind[];
	receivers?: Receiver[];
};

export function definePlugin(plugin: Plugin): Plugin {
	return plugin;
}

export type MontiOptions = {
	db: Kysely<Database>;
	/** `monti.schema.ts`. */
	schema?: Schema;
	/** The way to the schema file and change files, on the dev server only. Without it, structure values are locked (the live site). */
	files?: SchemaFiles | null;
	operations?: AnyOperation[];
	recordKinds?: RecordKind[];
	receivers?: Receiver[];
	plugins?: Plugin[];
	now?: () => Date;
	/**
	 * Keeps the first send of a write's events going after the response (a serverless host's `waitUntil`). Without it the write waits for the send.
	 */
	waitUntil?: (work: Promise<unknown>) => void;
};

/** An operation as the agent and the CLI discover it. */
export type Capability = {
	name: string;
	kind: OperationKind;
	description: string;
	humanOnly: boolean;
	/** The input's JSON Schema, from its Zod schema. */
	inputSchema: unknown;
};

export const describe = (operation: AnyOperation): Capability => ({
	name: operation.name,
	kind: operation.kind,
	description: operation.description,
	humanOnly: operation.humanOnly ?? false,
	inputSchema: z.toJSONSchema(operation.input, { io: "input", unrepresentable: "any" }),
});

/** Whether an entry point offers the operation to this caller: the assistant gets no human-only one, nobody gets a structure one on the live site. */
export const available = (operation: AnyOperation, actor: Actor, structureOpen: boolean) =>
	!(operation.humanOnly && actor === "assistant") &&
	!(operation.structure && !structureOpen) &&
	!(operation.kind === "screen" && actor === "cli");

/** The core's own operations that belong to the engine itself. */
function engineOperations(engine: Engine, all: () => AnyOperation[]): AnyOperation[] {
	return [
		defineOperation({
			name: "meta.capabilities",
			kind: "read",
			description:
				"List every operation this site offers, the plugins' included, with its description and input schema. Read it before planning work.",
			input: z.object({}),
			run: (_input, ctx) =>
				all()
					.filter((operation) => available(operation, ctx.actor, ctx.site.files !== null))
					.map(describe),
		}),
		defineOperation({
			name: "activity.undo",
			kind: "write",
			description:
				"Undo a write from the activity log. Records changed since that write are skipped, never overwritten. Works for 30 days.",
			input: z.object({ id: z.string() }),
			preview: async (input, ctx): Promise<Preview> => {
				const plan = await planUndo(engine, ctx.db, input.id);
				return {
					summary: { key: "activity.undo", values: { count: plan.restore.length } },
					changes: plan.restore,
					blocked: plan.skip.map((ref) => ({ ref, reason: { key: "activity.changedSince" } })),
				};
			},
			run: (input, ctx) => undo(engine, ctx.db, input.id),
			summary: (_input, output) => ({ key: "activity.undo", values: { count: output.restore.length } }),
		}),
	];
}

export type Monti = ReturnType<typeof createMonti>;

/** Builds a site's Monti: its operations, plugins included, and the engine every entry point runs them through. */
export function createMonti(options: MontiOptions) {
	const plugins = options.plugins ?? [];
	const recordKinds = new Map<string, RecordKind>();
	for (const kind of [
		...schemaRecordKinds,
		...(options.recordKinds ?? []),
		...plugins.flatMap((plugin) => plugin.recordKinds ?? []),
	]) {
		if (recordKinds.has(kind.kind)) throw new Error(`Record kind "${kind.kind}" is defined twice.`);
		recordKinds.set(kind.kind, kind);
	}
	const receivers = [...(options.receivers ?? []), ...plugins.flatMap((plugin) => plugin.receivers ?? [])];
	const now = options.now ?? (() => new Date());
	const site = createSite(options.schema ?? { collections: {} }, options.files ?? null);
	const engine: Engine = { db: options.db, recordKinds, receivers, site, now };

	const operations = new Map<string, AnyOperation>();
	const add = (operation: AnyOperation, from: string) => {
		if (operations.has(operation.name)) throw new Error(`Operation "${operation.name}" from ${from} is defined twice.`);
		operations.set(operation.name, operation);
	};
	for (const operation of [...engineOperations(engine, () => [...operations.values()]), ...schemaOperations])
		add(operation, "the core");
	for (const operation of options.operations ?? []) add(operation, "the site");
	for (const plugin of plugins)
		for (const operation of plugin.operations ?? []) add(operation, `plugin ${plugin.name}`);

	const get = (name: string, kinds: OperationKind[]) => {
		const operation = operations.get(name);
		if (!operation || !kinds.includes(operation.kind)) throw new UnknownOperationError(name);
		return operation;
	};

	const write = async <Output>(operation: AnyOperation, input: unknown, runOptions: RunOptions) => {
		const result = await runWrite<Output>(engine, operation, input, runOptions);
		const sending = sendDeliveries(engine.db, receivers, result.deliveryIds, now());
		if (options.waitUntil) options.waitUntil(sending);
		else await sending;
		return result;
	};

	return {
		db: options.db,
		site,
		operations: operations as ReadonlyMap<string, AnyOperation>,

		/**
		 * Runs an operation at once, as a person does (the admin API, the CLI) or as the assistant does for a read. A screen operation is the browser's,
		 * so the server refuses it.
		 */
		async run(name: string, input: unknown, runOptions: RunOptions): Promise<unknown> {
			const operation = get(name, ["read", "write"]);
			if (operation.kind === "read") return runRead(engine, operation, input, runOptions.actor);
			const { deliveryIds: _sent, ...result } = await write(operation, input, runOptions);
			return result;
		},

		proposals: {
			create: (conversationId: string, request: string) => createProposal(engine, conversationId, request),
			/** Adds an assistant write to a proposal; nothing changes until a person applies it. */
			add: (proposalId: string, name: string, input: unknown) =>
				proposeItem(engine, proposalId, get(name, ["write"]), input),
			/** Applies the pending items a person kept (all when `include` is left out). */
			apply: (proposalId: string, include?: string[]): Promise<ApplyResult> =>
				applyProposal(engine, operations, proposalId, include, write),
		},

		deliveries: {
			/** Sends the retries that are due (`monti deliveries:run`, and when the admin opens). */
			sendDue: () => sendDueDeliveries(engine.db, receivers, now()),
		},
	};
}
