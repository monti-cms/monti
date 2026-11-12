import type { Kysely } from "kysely";
import { z } from "zod";
import { activityOperations } from "./activity/operations";
import type { DevProof } from "./auth/dev-bypass";
import { type AuthSettings, authOperations } from "./auth/operations";
import { type AnyBlockDefinition, createBlockKit, type MarkDefinition } from "./body/blocks";
import { bodyOperations, templateRecord } from "./body/operations";
import type { Database } from "./db/schema";
import { type Receiver, sendDeliveries, sendDueDeliveries } from "./engine/deliveries";
import { context, type Engine, type RunOptions, runRead, runWrite } from "./engine/execute";
import { type ApplyResult, applyProposal, createProposal, proposeItem, settleProposal } from "./engine/proposals";
import { listOperations } from "./entries/list";
import { entryOperations } from "./entries/operations";
import { entryRecord } from "./entries/record";
import type { PublishCheck } from "./entries/tasks";
import { UnknownOperationError } from "./errors";
import { folderOperations, folderRecord } from "./folders/operations";
import { addKeyUsage, keyOperations, keyRecord, openKey } from "./keys/operations";
import { aiServices, type KeyService } from "./keys/services";
import { mediaOperations } from "./media/operations";
import { mediaRecord } from "./media/record";
import type { Storage } from "./media/storage";
import { type Actor, type AnyOperation, defineOperation, type OperationKind, recordKey } from "./operation";
import type { RecordKind } from "./records";
import { relationOperations } from "./relations/operations";
import type { Schema } from "./schema/define";
import type { SchemaFiles } from "./schema/files";
import { schemaOperations, schemaRecordKinds } from "./schema/operations";
import { createSite } from "./site";
import { translationOperations } from "./translations/operations";
import { trashOperations } from "./trash/operations";
import { purgeDue } from "./trash/purge";

/** A site without a schema file yet: one language and no collections. */
const EMPTY_SCHEMA: Schema = {
	locales: { source: "en", list: [{ code: "en", name: "English" }], prefix: "never" },
	collections: {},
};

/** A plugin adds operations (and the records and receivers they need) the same way the core does, so they become API routes, tools and commands too. */
export type Plugin = {
	name: string;
	operations?: AnyOperation[];
	recordKinds?: RecordKind[];
	receivers?: Receiver[];
	/** Rows it adds to the publish to-do list (doc 02). */
	publishChecks?: PublishCheck[];
	/** Body blocks and marks it brings (doc 03). */
	blocks?: AnyBlockDefinition[];
	marks?: MarkDefinition[];
	/** Where the site's media files go (doc 09). A site has one. */
	storage?: Storage;
	/** Services it brings that a key can be added for (doc 14). */
	keyServices?: KeyService[];
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
	/** The site's own body blocks and marks (`defineBlock`), next to the core's. */
	blocks?: AnyBlockDefinition[];
	marks?: MarkDefinition[];
	/** The ways to sign in that `monti init` chose. Without one, the admin says sign-in is not set up. */
	auth?: Partial<AuthSettings>;
	/** How a browser proves it runs on this machine (the dev server's sign-in bypass, doc 16). */
	devProof?: DevProof | null;
	/** `MONTI_SECRET`: signs preview links and seals service keys (doc 14). */
	secret?: string | null;
	/** The `fetch` the server calls other services with (tests and Storybook replace it). */
	fetch?: typeof globalThis.fetch;
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
	!(operation.open && actor !== "admin") &&
	!(operation.humanOnly && actor === "assistant") &&
	!(operation.structure && !structureOpen) &&
	!(operation.kind === "screen" && actor === "cli");

/** The core's own operations that belong to the engine itself. */
function engineOperations(all: () => AnyOperation[]): AnyOperation[] {
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
			name: "proposals.forTarget",
			kind: "read",
			description:
				"The assistant's pending proposal items aimed at one record (an entry, the schema, a collection's admin values): what a screen draws as blue pencil. Each has its operation, input and the request it came from.",
			input: z.object({ kind: z.string(), id: z.string() }),
			async run(input, ctx) {
				const rows = await ctx.db
					.selectFrom("monti_proposal_item")
					.innerJoin("monti_proposal", "monti_proposal.id", "monti_proposal_item.proposal_id")
					.select([
						"monti_proposal_item.id",
						"monti_proposal_item.proposal_id as proposalId",
						"monti_proposal_item.operation",
						"monti_proposal_item.input",
						"monti_proposal_item.base_versions as baseVersions",
						"monti_proposal.request",
						"monti_proposal.conversation_id as conversationId",
					])
					.where("monti_proposal_item.state", "=", "pending")
					.orderBy("monti_proposal.created_at")
					.orderBy("monti_proposal_item.position")
					.execute();
				const key = recordKey(input);
				return rows.filter((row) => key in row.baseVersions);
			},
		}),
		defineOperation({
			name: "proposals.discard",
			kind: "write",
			humanOnly: true,
			description: "Throw away pending proposal items. Only a person does it; it is never an agent tool.",
			input: z.object({ ids: z.array(z.string()).min(1) }),
			async run(input, ctx) {
				const items = await ctx.db
					.updateTable("monti_proposal_item")
					.set({ state: "discarded" })
					.where("id", "in", input.ids)
					.where("state", "=", "pending")
					.returning(["id", "proposal_id"])
					.execute();
				for (const proposalId of new Set(items.map((item) => item.proposal_id)))
					await settleProposal(ctx.db, proposalId);
				return { discarded: items.map((item) => item.id) };
			},
			// Nothing changed, so the log has no line for it (doc 00).
			log: false,
			summary: (_input, output) => ({ key: "proposals.discard", values: { count: output.discarded.length } }),
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
		entryRecord,
		templateRecord,
		folderRecord,
		mediaRecord,
		keyRecord,
		...(options.recordKinds ?? []),
		...plugins.flatMap((plugin) => plugin.recordKinds ?? []),
	]) {
		if (recordKinds.has(kind.kind)) throw new Error(`Record kind "${kind.kind}" is defined twice.`);
		recordKinds.set(kind.kind, kind);
	}
	const receivers = [...(options.receivers ?? []), ...plugins.flatMap((plugin) => plugin.receivers ?? [])];
	const storages = plugins.filter((plugin) => plugin.storage);
	if (storages.length > 1)
		throw new Error(
			`Two plugins bring a media storage: ${storages.map((plugin) => plugin.name).join(", ")}. A site has one.`,
		);
	const keyServices = [...aiServices, ...plugins.flatMap((plugin) => plugin.keyServices ?? [])];
	for (const service of keyServices)
		if (keyServices.filter((other) => other.id === service.id).length > 1)
			throw new Error(`Key service "${service.id}" is defined twice.`);
	const now = options.now ?? (() => new Date());
	const site = createSite(options.schema ?? EMPTY_SCHEMA, options.files ?? null, {
		publishChecks: plugins.flatMap((plugin) => plugin.publishChecks ?? []),
		secret: options.secret,
		storage: storages[0]?.storage ?? null,
		keyServices,
		fetch: options.fetch,
		auth: {
			password: options.auth?.password ?? false,
			github: options.auth?.github ?? null,
			devBypass: options.auth?.devBypass ?? true,
		},
		devProof: options.devProof ?? null,
		kit: createBlockKit(
			[...(options.blocks ?? []), ...plugins.flatMap((plugin) => plugin.blocks ?? [])],
			[...(options.marks ?? []), ...plugins.flatMap((plugin) => plugin.marks ?? [])],
		),
	});
	const engine: Engine = { db: options.db, recordKinds, receivers, site, now };

	const operations = new Map<string, AnyOperation>();
	const add = (operation: AnyOperation, from: string) => {
		if (operations.has(operation.name)) throw new Error(`Operation "${operation.name}" from ${from} is defined twice.`);
		operations.set(operation.name, operation);
	};
	for (const operation of [
		...engineOperations(() => [...operations.values()]),
		...activityOperations(engine),
		...schemaOperations,
		...entryOperations,
		...listOperations,
		...translationOperations,
		...relationOperations,
		...folderOperations,
		...mediaOperations,
		...trashOperations,
		...keyOperations,
		...bodyOperations,
		...authOperations,
	])
		add(operation, "the core");
	for (const operation of options.operations ?? []) add(operation, "the site");
	for (const plugin of plugins)
		for (const operation of plugin.operations ?? []) add(operation, `plugin ${plugin.name}`);

	/**
	 * Sending whose result nobody reads. A serverless host keeps it going after the response (`waitUntil`). A send that throws (the database went
	 * away) is logged and not passed on: the write it follows has committed, the delivery is still queued, and the next visit or
	 * `monti deliveries:run` sends it.
	 */
	const background = (work: Promise<void>): Promise<void> => {
		const safe = work.catch((error) => {
			console.error("Monti: sending deliveries failed; they stay queued for the next try:", error);
		});
		options.waitUntil?.(safe);
		return safe;
	};

	const get = (name: string, kinds: OperationKind[]) => {
		const operation = operations.get(name);
		if (!operation || !kinds.includes(operation.kind)) throw new UnknownOperationError(name);
		return operation;
	};

	const write = async <Output>(operation: AnyOperation, input: unknown, runOptions: RunOptions) => {
		const result = await runWrite<Output>(engine, operation, input, runOptions);
		const sent = background(sendDeliveries(engine.db, receivers, result.deliveryIds, now));
		// Without a host that keeps work going after the response, the write waits for its first send.
		if (!options.waitUntil) await sent;
		if (!operation.afterCommit) return result;
		// What waits for the commit and is waited for: a deleted file's bytes leave the storage, a failed delivery is sent again.
		const settled = await operation.afterCommit(
			result.output,
			context(engine, engine.db, runOptions.actor, runOptions.session ?? null).ctx,
		);
		return settled === undefined ? result : { ...result, output: settled as Output };
	};

	return {
		db: options.db,
		now,
		site,
		operations: operations as ReadonlyMap<string, AnyOperation>,

		/**
		 * Runs an operation at once, as a person does (the admin API, the CLI) or as the assistant does for a read. A screen operation is the browser's,
		 * so the server refuses it.
		 */
		async run(name: string, input: unknown, runOptions: RunOptions): Promise<unknown> {
			const operation = get(name, ["read", "write"]);
			// Signing in belongs to the admin API alone: no command or tool reaches it.
			if (operation.open && runOptions.actor !== "admin") throw new UnknownOperationError(name);
			if (operation.kind === "read") return runRead(engine, operation, input, runOptions.actor, runOptions.session);
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
			/** Sends the retries that are due and waits for them (`monti deliveries:run`). */
			sendDue: () => sendDueDeliveries(engine.db, receivers, now),
			/**
			 * Sends the retries that are due without holding the caller: the admin opening must not wait for a receiver that does not answer (T5). The
			 * promise is for tests and for a host that wants to wait.
			 */
			sendDueInBackground: (): Promise<void> => background(sendDueDeliveries(engine.db, receivers, now)),
		},

		keys: {
			/** A key opened for the server to call its service with; `null` when it is gone or the server's secret does not open it. No operation returns it. */
			open: (id: string) => openKey(engine.db, site.secret, id),
			/** Counts the tokens a call spent against its key, in the month of `at`, the time the call was made (doc 14: tokens per month, no money). */
			addUsage: (id: string, tokens: number, at: Date = now()) => addKeyUsage(engine.db, id, tokens, at),
		},

		trash: {
			/** Deletes what the trash has kept for 30 days, with the snapshots and files nothing needs any more (`monti trash:purge`, and when the admin opens). */
			purgeDue: () => purgeDue(engine.db, site.schema(), site.storage, now()),
		},
	};
}
