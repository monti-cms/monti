import type { Kysely } from "kysely";
import { z } from "zod";
import { activityOperations } from "./activity/operations";
import type { DevProof } from "./auth/dev-bypass";
import { type AuthSettings, authOperations } from "./auth/operations";
import { type AnyBlockDefinition, createBlockKit, type MarkDefinition } from "./body/blocks";
import { bodyOperations, templateRecord } from "./body/operations";
import type { Database, ItemExchange } from "./db/schema";
import { BEFORE_ANSWER_MS, type Receiver, sendDeliveries, sendDueDeliveries } from "./engine/deliveries";
import { context, type Engine, logOwnWork, type RunOptions, runRead, runWrite } from "./engine/execute";
import {
	type ApplyProgress,
	type ApplyResult,
	addExchange,
	applyProposal,
	createProposal,
	lockProposals,
	type ProposalView,
	proposeItem,
	replaceItem,
	revertProposal,
	settleProposal,
	viewProposal,
	type WriteHolder,
} from "./engine/proposals";
import { listOperations } from "./entries/list";
import { entryOperations } from "./entries/operations";
import { entryRecord } from "./entries/record";
import type { PublishCheck } from "./entries/tasks";
import { CheckError, InputError, UnknownOperationError } from "./errors";
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
import { type AnyStream, defineStream, type StreamContext } from "./stream";
import { translationOperations } from "./translations/operations";
import { trashOperations } from "./trash/operations";
import { purgeDue, purgedEvents } from "./trash/purge";

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
	/** Work it streams (doc 10: the assistant's run). */
	streams?: AnyStream[];
	/** Its own clean-up, run with the trash's (when the admin opens, and `monti trash:purge`): what it keeps for a time and then removes. */
	cleanUp?: (monti: Monti) => Promise<void>;
	/**
	 * Called once with the site it was built into. An operation gets only its own context; a plugin whose operations run other operations (the
	 * assistant's quick tasks read the models and open a key) keeps the site from here.
	 */
	attach?: (monti: Monti) => void;
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
	 * Keeps a write's first sends going after the response: the host is given the work to start, and starts it where it holds work open (a
	 * serverless host's `waitUntil`, Next's `after`). Without it the write waits for the send.
	 */
	waitUntil?: (work: () => Promise<unknown>) => void;
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

/** One step of a proposal being applied, or its end with every item's result. */
export type ApplyEvent = ({ type: "item" } & ApplyProgress) | { type: "end"; results: ApplyResult };

/** The core's own operations that belong to the engine itself. */
function engineOperations(
	engine: Engine,
	all: () => AnyOperation[],
	byName: () => ReadonlyMap<string, AnyOperation>,
): AnyOperation[] {
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
			name: "proposals.get",
			kind: "read",
			description:
				"One proposal as its card and its review show it: the request, every item with its group, its state, whether the person keeps it and whether its record changed in the meantime, what the records are called, and how many items applying would run.",
			input: z.object({ id: z.string() }),
			async run(input, ctx): Promise<ProposalView> {
				const view = await viewProposal(engine, byName(), ctx.db, input.id);
				if (!view) throw new CheckError({ key: "proposals.unknown" });
				return view;
			},
		}),
		defineOperation({
			name: "proposals.include",
			kind: "write",
			humanOnly: true,
			bookkeeping: true,
			log: false,
			description:
				"Keep waiting proposal items in the proposal or leave them out (the review's checks). An item left out is not applied. Only a person does it.",
			input: z.object({ ids: z.array(z.string()).min(1), included: z.boolean() }),
			async run(input, ctx) {
				const items = await ctx.db
					.updateTable("monti_proposal_item")
					.set({ included: input.included })
					.where("id", "in", input.ids)
					.where("state", "in", ["pending", "stale"])
					.returning("id")
					.execute();
				return { changed: items.map((item) => item.id) };
			},
			summary: (input) => ({ key: "proposals.include", values: { count: input.ids.length } }),
		}),
		defineOperation({
			name: "proposals.revert",
			kind: "write",
			humanOnly: true,
			// The lines it undoes say "undone" with when; a line of its own would say it twice (as `activity.undo`).
			log: false,
			description:
				"Put back everything applying a proposal changed, as the activity log's undo does for each write. A record changed since is left alone and its item stays applied. Only a person does it.",
			input: z.object({ id: z.string() }),
			async run(input, ctx) {
				// The deliveries of what it puts back show on the lines that were undone, as the log's own undo has them.
				const output = await revertProposal(engine, ctx.db, input.id, (event, undone) =>
					ctx.emit(event, { activity: undone }),
				);
				return output;
			},
			summary: (_input, output) => ({
				key: "proposals.revert",
				values: { count: output.reverted.length, kept: output.kept.length },
			}),
		}),
		defineOperation({
			name: "proposals.discard",
			kind: "write",
			humanOnly: true,
			bookkeeping: true,
			description:
				"Throw away waiting proposal items: the ones named, or with `proposal` every waiting item of that proposal. Nothing of the site changes, so it leaves no activity row. Only a person does it; it is never an agent tool.",
			input: z
				.object({ ids: z.array(z.string()).min(1).optional(), proposal: z.string().optional() })
				.refine((input) => (input.ids === undefined) !== (input.proposal === undefined), {
					message: "Give ids or proposal, one of them.",
				}),
			async run(input, ctx) {
				// The proposals' rows before their items', the order everything that decides about a proposal takes them in.
				await lockProposals(
					ctx.db,
					input.proposal !== undefined ? { proposals: [input.proposal] } : { items: input.ids ?? [] },
				);
				const items = await ctx.db
					.updateTable("monti_proposal_item")
					.set({ state: "discarded" })
					.where((eb) =>
						input.proposal !== undefined ? eb("proposal_id", "=", input.proposal) : eb("id", "in", input.ids ?? []),
					)
					.where("state", "in", ["pending", "stale"])
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
	// A delivery finds its receiver by name: two under one name would both resolve to the first, which would get each event twice.
	for (const receiver of receivers)
		if (receivers.filter((other) => other.destination === receiver.destination).length > 1)
			throw new Error(
				`Two receivers are named "${receiver.destination}". Give one a name of its own: webhook(url, { name: "…" }).`,
			);
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
		...engineOperations(
			engine,
			() => [...operations.values()],
			() => operations,
		),
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
	 * A send that throws (the database went away) is logged and not passed on: the write it follows has committed, the delivery is still queued,
	 * and the next visit or `monti deliveries:run` sends it.
	 */
	const quiet = (work: Promise<unknown>): Promise<void> =>
		work.then(
			() => {},
			(error) => {
				console.error("Monti: sending deliveries failed; they stay queued for the next try:", error);
			},
		);
	/**
	 * Sending whose result nobody reads. The host is given the work to start, and starts it where it keeps work going after the response
	 * (`waitUntil`; Next's `after`): what a receiver does there is then inside the host's own scope, not in a promise that began in a request
	 * and ends after it. Without a host's way the work starts now. The promise ends when the work does, for a caller that wants to wait.
	 */
	const background = (start: () => Promise<unknown>): Promise<void> => {
		const keep = options.waitUntil;
		if (!keep) return quiet(start());
		return new Promise<void>((done) => keep(() => quiet(start()).then(done)));
	};

	/**
	 * A write's first send. Without a host that keeps work going after the response, the write waits for all of it. With one, it waits only for
	 * the receivers that ask to be done before the answer (the site's own cached pages: a publish that answered is on the site), and the rest
	 * goes on after the response, so a webhook that does not answer never holds a save.
	 *
	 * The wait has one deadline for the whole write (`BEFORE_ANSWER_MS`), however many events it emitted: at the deadline no further send is
	 * started, the write answers, and what is left is sent behind the answer.
	 */
	const firstSend = async (ids: string[]): Promise<void> => {
		if (ids.length === 0) return;
		const keep = options.waitUntil;
		if (!keep) return quiet(sendDeliveries(engine.db, receivers, ids, now));
		const first = receivers.filter((receiver) => receiver.beforeAnswer);
		const rest = receivers.filter((receiver) => !receiver.beforeAnswer);
		// Each pass leaves the other's deliveries untried: a delivery is sent by the pass that has its receiver.
		if (first.length > 0) {
			let over = false;

			/** What the deadline kept from starting: these alone are sent behind the answer, each still once. */
			const left: string[] = [];
			const pass = quiet(
				sendDeliveries(engine.db, first, ids, now, {
					leaveUnknown: true,
					stop: () => over,
					notStarted: (id) => left.push(id),
				}),
			);
			let timer: ReturnType<typeof setTimeout> | undefined;
			const late = new Promise<"late">((resolve) => {
				timer = setTimeout(() => {
					over = true;
					resolve("late");
				}, BEFORE_ANSWER_MS);
			});
			const outcome = await Promise.race([pass.then(() => "done" as const), late]);
			clearTimeout(timer);
			// The sends under way end by themselves; what was never started is started behind the answer, in the host's own scope.
			if (outcome === "late")
				keep(() => pass.then(() => quiet(sendDeliveries(engine.db, first, left, now, { leaveUnknown: true }))));
		}
		if (rest.length > 0) void background(() => sendDeliveries(engine.db, rest, ids, now, { leaveUnknown: true }));
	};

	const get = (name: string, kinds: OperationKind[]) => {
		const operation = operations.get(name);
		if (!operation || !kinds.includes(operation.kind)) throw new UnknownOperationError(name);
		return operation;
	};

	const write = async <Output>(operation: AnyOperation, input: unknown, runOptions: RunOptions) => {
		const result = await runWrite<Output>(engine, operation, input, runOptions);
		await firstSend(result.deliveryIds);
		if (!operation.afterCommit) return result;
		// What waits for the commit and is waited for: a deleted file's bytes leave the storage, a failed delivery is sent again.
		const settled = await operation.afterCommit(
			result.output,
			context(engine, engine.db, runOptions.actor, runOptions.session ?? null).ctx,
		);
		return settled === undefined ? result : { ...result, output: settled as Output };
	};

	const streams = new Map<string, AnyStream>();
	const addStream = (stream: AnyStream, from: string) => {
		if (streams.has(stream.name) || operations.has(stream.name))
			throw new Error(`Stream "${stream.name}" from ${from} is defined twice.`);
		streams.set(stream.name, stream);
	};

	const monti = {
		db: options.db,
		now,
		site,
		operations: operations as ReadonlyMap<string, AnyOperation>,
		streams: streams as ReadonlyMap<string, AnyStream>,

		/**
		 * Starts a stream (doc 10): its events as they come. The input is checked before anything runs; whoever stops listening ends it through
		 * `signal`.
		 */
		stream(name: string, input: unknown, context: Omit<StreamContext, "monti">): AsyncIterable<unknown> {
			const stream = streams.get(name);
			if (!stream) throw new UnknownOperationError(name);
			const parsed = stream.input.safeParse(input);
			if (!parsed.success) throw new InputError(parsed.error.issues);
			return stream.run(parsed.data, { ...context, monti });
		},

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
			create: (conversationId: string, request: string, runId: string | null = null) =>
				createProposal(engine, conversationId, request, runId),
			/**
			 * Adds an assistant write to a proposal; nothing changes until a person applies it. A write that names several records (`each`) becomes one
			 * item per record. `group` is the name the assistant gave this kind of change. `call` names the tool call that asks, and `holder` is
			 * asked, in the transaction that stores the items, whether the caller is still the one to write (`WriteHolder`).
			 */
			add: (proposalId: string, name: string, input: unknown, group?: string, call?: string, holder?: WriteHolder) =>
				proposeItem(engine, operations, proposalId, get(name, ["write"]), input, { group, call, holder }),
			/** Puts a new write in a waiting item's place: the item made again, or changed at its own place (doc 10). */
			replace: (itemId: string, name: string, input: unknown, call?: string, holder?: WriteHolder) =>
				replaceItem(engine, operations, itemId, get(name, ["write"]), input, { call, holder }),
			/** Adds what was asked of an item at its place, and the answer, to the item. */
			addExchange: (itemId: string, exchange: ItemExchange) => addExchange(engine.db, itemId, exchange),
			/** A proposal as its card and review show it; `null` when there is none. */
			view: (proposalId: string) => viewProposal(engine, operations, engine.db, proposalId),
			/**
			 * Applies the waiting items a person kept, one write each; `include` says which instead of the stored checks. Run again after it was cut
			 * short, it goes on with what is left.
			 */
			apply: (
				proposalId: string,
				include?: string[],
				onProgress?: (progress: ApplyProgress) => void | Promise<void>,
				leaseMs?: number,
			): Promise<ApplyResult> => applyProposal(engine, operations, proposalId, include, write, onProgress, leaseMs),
		},

		deliveries: {
			/**
			 * Sends the retries that are due, a sweep's worth, and waits for them (`monti deliveries:run`). With `leaveUnknown`, a delivery whose
			 * receiver this process does not have is left untried and counted in `left`: the command line has no Next around it, and a try from
			 * there would write a failure that is not one.
			 */
			sendDue: (sweep: { leaveUnknown?: boolean } = {}) => sendDueDeliveries(engine.db, receivers, now, sweep),
			/**
			 * Sends the retries that are due without holding the caller: the admin opening must not wait for a receiver that does not answer (T5). The
			 * promise is for tests and for a host that wants to wait.
			 */
			sendDueInBackground: (): Promise<void> => background(() => sendDueDeliveries(engine.db, receivers, now)),
		},

		keys: {
			/** A key opened for the server to call its service with; `null` when it is gone or the server's secret does not open it. No operation returns it. */
			open: (id: string) => openKey(engine.db, site.secret, id),
			/** Counts the tokens a call spent against its key, in the month of `at`, the time the call was made (doc 14: tokens per month, no money). */
			addUsage: (id: string, tokens: number, at: Date = now()) => addKeyUsage(engine.db, id, tokens, at),
		},

		trash: {
			/**
			 * Deletes what the trash has kept for 30 days, with the snapshots and files nothing needs any more (`monti trash:purge`, and when the admin
			 * opens). It is no operation, and still it is a line of the log that tells the receivers which entries are gone, in the purge's own
			 * transaction (doc 13): `actor` is who set it going.
			 */
			async purgeDue(actor: "cli" | "admin" = "cli") {
				const { deliveryIds, ...result } = await purgeDue(engine.db, site.schema(), site.storage, now(), (trx, gone) =>
					logOwnWork(engine, trx, {
						actor,
						operation: "trash.purgeDue",
						summary: { key: "trash.purgedDue", values: { count: gone.count } },
						where: { key: "activity.where.trash" },
						kind: "trash",
						events: purgedEvents(gone.entries),
					}),
				);
				await firstSend(deliveryIds);
				return result;
			},
		},

		/** The plugins' own clean-ups, run with the trash's (when the admin opens, and `monti trash:purge`). One that fails does not stop the others. */
		async cleanUp(): Promise<void> {
			for (const plugin of plugins) {
				try {
					await plugin.cleanUp?.(monti);
				} catch (error) {
					console.error(`Monti: the clean-up of plugin ${plugin.name} failed; the next one tries again:`, error);
				}
			}
		},
	};

	addStream(
		defineStream({
			name: "proposals.apply",
			description:
				"Apply a proposal: each waiting item the person kept runs as its own write, in order. Each item's result comes as it is done; an item that fails or changed in the meantime is reported and the rest go on. Started again after it was cut short, it goes on with what is left.",
			input: z.object({ id: z.string() }),
			run: (input) => applying(monti.proposals.apply, input.id),
		}),
		"the core",
	);
	for (const plugin of plugins) for (const stream of plugin.streams ?? []) addStream(stream, `plugin ${plugin.name}`);
	for (const plugin of plugins) plugin.attach?.(monti);
	return monti;
}

/** An apply as a stream: each item's result as it lands, then the end with all of them. */
async function* applying(
	apply: (id: string, include: undefined, onProgress: (progress: ApplyProgress) => void) => Promise<ApplyResult>,
	id: string,
): AsyncGenerator<ApplyEvent> {
	const queue: ApplyEvent[] = [];
	let wake = () => {};
	let ended = false;
	let failure: unknown = null;
	// The apply runs on whether or not anyone still listens: what it started is stored item by item.
	void apply(id, undefined, (progress) => {
		queue.push({ type: "item", ...progress });
		wake();
	})
		.then(
			(results) => {
				queue.push({ type: "end", results });
			},
			(error: unknown) => {
				failure = error;
			},
		)
		.finally(() => {
			ended = true;
			wake();
		});
	for (;;) {
		while (queue.length > 0) yield queue.shift() as ApplyEvent;
		if (ended) break;
		await new Promise<void>((resolve) => {
			wake = resolve;
		});
	}
	if (failure) throw failure;
}
