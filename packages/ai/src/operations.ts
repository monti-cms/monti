import {
	CheckError,
	type Database,
	defineOperation,
	definePlugin,
	defineStream,
	type ModelList,
	type Monti,
	type Plugin,
	type RunStatus,
} from "@monti-cms/core";
import { type Kysely, sql, type Transaction } from "kysely";
import { z } from "zod";
import { aiSdkProvider } from "./ai-sdk";
import type { ProviderFor } from "./provider";
import { QuickInput, type QuickOutput, quickFill } from "./quick";
import {
	abortRun,
	DEFAULT_LIMITS,
	HOLD_MS,
	historyBudget,
	type RunEnd,
	RunInput,
	type RunLimits,
	recalled,
	runAssistant,
	type StoredMessage,
} from "./run";
import { assistantTools } from "./tools";

type Db = Kysely<Database> | Transaction<Database>;

/** How long a conversation nobody opened is kept, until the person says otherwise (doc 10). */
export const KEEP_DAYS = 30;
/** The choices the past conversations' foot offers; `null` keeps them for good. */
export const KEEP_CHOICES = [7, 30, 90, null] as const;

export type AssistantOptions = {
	/**
	 * The model service for a key. Left out, the real ones through the AI SDK (`aiSdkProvider`). Tests and Storybook hand in a scripted one, so no
	 * test calls a model.
	 */
	provider?: ProviderFor;
	limits?: Partial<RunLimits>;
	/** How long a request holds its run after its last sign of life (`HOLD_MS`). Tests shorten it. */
	holdMs?: number;
};

/** What became of a conversation's proposals, for its row in the past conversations (doc 10). */
export type ConversationOutcome =
	| { kind: "waiting" }
	| { kind: "applied"; count: number }
	| { kind: "taken"; count: number }
	| { kind: "reverted" }
	| { kind: "discarded" };

export type ConversationRow = { id: string; title: string; at: Date; outcome: ConversationOutcome | null };

/** One thing a run showed, in the order it came: words, a tool line, something the person said meanwhile. */
export type TranscriptPart =
	| { type: "text"; text: string }
	| { type: "tool"; id: string; name: string; kind: string; input: unknown; failed: boolean; count?: number }
	| { type: "said"; text: string };

export type TranscriptRun = {
	id: string;
	status: RunStatus;
	request: string;
	/** What was on screen when it was asked, as it was sent (the chips). */
	context: unknown;
	model: string;
	thinking: string;
	startedAt: Date;
	parts: TranscriptPart[];
	/** The proposal it made, shown as a card under its answer. */
	proposalId: string | null;
	end: RunEnd | null;
	usage: { input: number; output: number };
};

export type Conversation = {
	id: string;
	title: string;
	model: { keyId: string; model: string } | null;
	thinking: string | null;
	/** The newest requests, oldest first: at most a page of them. */
	runs: TranscriptRun[];
	/** Where the requests before these begin (`before` of the next read); `null` when these are the first. */
	earlier: Place | null;
	/**
	 * How many of its oldest requests the next request would not send to the model: the conversation is longer than the model's share for what
	 * was said before. They are still here to read; the model no longer knows them.
	 */
	forgotten: number;
};

/** A place in a list read a page at a time: the time of a row and its id, so rows of one moment are told apart. */
const Place = z.object({ at: z.string().datetime(), id: z.string() });
type Place = z.infer<typeof Place>;
const placeOf = (row: { at: Date; id: string } | undefined): Place | null =>
	row ? { at: row.at.toISOString(), id: row.id } : null;

/** How many conversations a page of the list holds, and how many requests of a conversation one read gives, unless fewer are asked for. */
const PAGE = { conversations: 50, runs: 30 } as const;

export type AssistantState = {
	/** Whether a run can start: a readable AI key with a model is there. Without it the panel only says so and points at the keys screen. */
	connected: boolean;
	/** The last things asked, newest first: the empty panel offers them again. */
	recent: string[];
	keepDays: number | null;
};

/** How many of a conversation's oldest requests its next request would leave out of what it sends the model (`Conversation.forgotten`). */
async function forgottenOf(
	db: Db,
	conversation: { id: string; key_id: string | null; model: string | null },
	limits: RunLimits,
	context: (keyId: string, model: string) => Promise<number | undefined>,
): Promise<number> {
	const runs = await db
		.selectFrom("runs")
		.select("size")
		.where("conversation_id", "=", conversation.id)
		.where("kind", "=", "chat")
		.orderBy("started_at", "desc")
		.orderBy("id", "desc")
		.execute();
	const window =
		conversation.key_id && conversation.model ? await context(conversation.key_id, conversation.model) : undefined;
	return (
		runs.length -
		recalled(
			runs.map((run) => run.size),
			historyBudget(limits, window),
		)
	);
}

const keepDaysOf = async (db: Db): Promise<number | null> => {
	const row = await db.selectFrom("assistant_settings").select("keep_days").where("id", "=", 1).executeTakeFirst();
	return row === undefined ? KEEP_DAYS : row.keep_days;
};

/** What a run showed, from what it stored. The first message is the request itself, which the run row holds. */
function partsOf(messages: StoredMessage[]): TranscriptPart[] {
	const parts: TranscriptPart[] = [];
	messages.forEach((message, index) => {
		if (message.role === "user") {
			if (index > 0) parts.push({ type: "said", text: message.text });
		} else if (message.role === "assistant") {
			if (message.text !== "") parts.push({ type: "text", text: message.text });
			const next = messages[index + 1];
			const answers = next?.role === "tools" ? next.answers : [];
			for (const call of message.calls) {
				const answer = answers.find((each) => each.id === call.id) as
					| { error: boolean; kind?: string; count?: number }
					| undefined;
				parts.push({
					type: "tool",
					id: call.id,
					name: call.name.replace(/_/, "."),
					kind: answer?.kind ?? "unknown",
					input: call.input,
					// A call with no answer is where the run stopped ("stopped here").
					failed: answer === undefined || answer.error,
					...(answer?.count !== undefined ? { count: answer.count } : {}),
				});
			}
		}
	});
	return parts;
}

async function outcomes(db: Db, conversationIds: string[]): Promise<Map<string, ConversationOutcome>> {
	const found = new Map<string, ConversationOutcome>();
	if (conversationIds.length === 0) return found;
	const rows = await db
		.selectFrom("monti_proposal")
		.innerJoin("monti_proposal_item", "monti_proposal_item.proposal_id", "monti_proposal.id")
		.leftJoin("monti_activity", "monti_activity.id", "monti_proposal_item.activity_id")
		.select([
			"monti_proposal.conversation_id as conversationId",
			"monti_proposal.id as proposalId",
			"monti_proposal.status",
			"monti_proposal.created_at as createdAt",
			"monti_proposal_item.state",
			"monti_activity.proposal_item_id as appliedBy",
		])
		.where("monti_proposal.conversation_id", "in", conversationIds)
		.orderBy("monti_proposal.created_at")
		.execute();
	// The newest proposal of each conversation says what became of it.
	const newest = new Map<string, typeof rows>();
	for (const row of rows) {
		const last = newest.get(row.conversationId);
		if (!last || last[0].proposalId !== row.proposalId) newest.set(row.conversationId, [row]);
		else last.push(row);
	}
	for (const [conversationId, items] of newest) {
		const status = items[0].status;
		const applied = items.filter((item) => item.state === "applied");
		// Applied through the review, or taken in a screen and saved with the person's own changes.
		const taken = applied.filter((item) => item.appliedBy === null).length;
		found.set(
			conversationId,
			items.some((item) => item.state === "pending")
				? { kind: "waiting" }
				: status === "reverted"
					? { kind: "reverted" }
					: status === "discarded"
						? { kind: "discarded" }
						: taken === applied.length && taken > 0
							? { kind: "taken", count: taken }
							: { kind: "applied", count: applied.length },
		);
	}
	return found;
}

/** Removes conversations with what belongs to them alone: their runs and messages, and their proposals that changed nothing. */
async function removeConversations(db: Db, ids: string[]): Promise<void> {
	if (ids.length === 0) return;
	// What was applied stays in the activity log, and so does its proposal; what still waited goes with the conversation (doc 10).
	await db
		.deleteFrom("monti_proposal_item")
		.where("state", "in", ["pending", "stale", "failed", "skipped", "discarded"])
		.where("proposal_id", "in", db.selectFrom("monti_proposal").select("id").where("conversation_id", "in", ids))
		.execute();
	await db
		.deleteFrom("monti_proposal")
		.where("conversation_id", "in", ids)
		.where("id", "not in", db.selectFrom("monti_proposal_item").select("proposal_id"))
		.execute();
	await db.deleteFrom("conversations").where("id", "in", ids).execute();
}

/** Removes the conversations nobody opened for the kept days (doc 10). Run with the trash's clean-up. */
export async function removeUnopened(monti: Monti): Promise<number> {
	const days = await keepDaysOf(monti.db);
	if (days === null) return 0;
	const before = new Date(monti.now().getTime() - days * 86_400_000);
	const due = await monti.db.selectFrom("conversations").select("id").where("last_opened_at", "<", before).execute();
	await removeConversations(
		monti.db,
		due.map((row) => row.id),
	);
	return due.length;
}

/**
 * The assistant as a plugin (doc 10): its operations, its run as a stream, and its clean-up. The core has the tables, the proposals and the
 * operations it uses as tools; this brings what calls a model.
 */
export function assistant(options: AssistantOptions = {}): Plugin {
	const limits: RunLimits = { ...DEFAULT_LIMITS, ...options.limits };
	const provider = options.provider ?? aiSdkProvider();
	// The site this plugin was built into: its operations that run other operations (the models, a key) reach them through it.
	let attached: Monti | null = null;
	const site = (): Monti => {
		if (!attached) throw new Error("The assistant plugin is used through createMonti({ plugins: [assistant(…)] }).");
		return attached;
	};
	return definePlugin({
		name: "assistant",
		attach: (monti) => {
			attached = monti;
		},
		cleanUp: async (monti) => {
			await removeUnopened(monti);
		},
		streams: [
			defineStream({
				name: "assistant.run",
				description:
					"Ask the assistant: a new request in a conversation, a request at one proposed change, or going on with a run that stopped. Its events come as it works: its words, the tools it calls, the proposal it adds to, and how it ended. It changes nothing of the site: what it would change is a proposal.",
				input: RunInput,
				run: (input, ctx) =>
					runAssistant(ctx.monti, { provider, limits, holdMs: options.holdMs ?? HOLD_MS }, input, ctx.signal),
			}),
		],
		operations: [
			defineOperation({
				name: "assistant.state",
				kind: "read",
				description:
					"Whether the assistant can run (an AI key with a model is there), the last things asked, and for how many days an unopened conversation is kept.",
				input: z.object({}),
				async run(_input, ctx): Promise<AssistantState> {
					const listed = (await site().run("models.list", {}, { actor: "admin" })) as ModelList;
					const recent = await ctx.db
						.selectFrom("runs")
						.select(["request", "started_at"])
						.where("kind", "=", "chat")
						.orderBy("started_at", "desc")
						.limit(20)
						.execute();
					return {
						// The panel asks `models.list` for the menu; this only says whether there is anything to ask with.
						connected: listed.assistant !== null,
						recent: [...new Set(recent.map((run) => run.request))].slice(0, 2),
						keepDays: await keepDaysOf(ctx.db),
					};
				},
			}),
			defineOperation({
				name: "assistant.tools",
				kind: "read",
				description:
					"The tools the assistant has on this site: one per operation it may use, the plugins' included, each with its kind (read, write, screen).",
				input: z.object({}),
				run: () => assistantTools(site()).map((tool) => ({ name: tool.operation, kind: tool.kind, tool: tool.name })),
			}),
			defineOperation({
				name: "assistant.fill",
				kind: "read",
				description:
					"Fill one field with the quick-task model, in one call: a text field, values for a relation field, a picture's alt text or caption, an address. It stores nothing: the screen puts the answer in the field.",
				input: QuickInput,
				run: (input): Promise<QuickOutput> => quickFill(site(), provider, input, limits.answerMs),
			}),
			defineOperation({
				name: "assistant.stop",
				kind: "write",
				humanOnly: true,
				bookkeeping: true,
				description:
					"Stop a run. What it proposed so far stays. What was said to it and not taken yet comes back in the answer when the run ends here (a run waiting on the browser); a run at work hands it back as its own end. Only a person does it.",
				input: z.object({ run: z.string() }),
				async run(input, ctx): Promise<{ stopped: boolean; untaken: string[] }> {
					const stopped = await ctx.db
						.updateTable("runs")
						.set({ stop_requested: true })
						.where("id", "=", input.run)
						.where("status", "in", ["running", "waiting"])
						.returning(["id", "status"])
						.executeTakeFirst();
					// A run waiting on the browser has no request running it: it ends here.
					if (stopped?.status === "waiting")
						await ctx.db
							.updateTable("runs")
							.set({
								status: "stopped",
								ended: JSON.stringify({ status: "stopped" } satisfies RunEnd),
								ended_at: ctx.now(),
								leased_until: null,
								lease_token: null,
							})
							.where("id", "=", input.run)
							.execute();
					// Nothing will take what was said to it: it goes back to the person, and no row is left behind.
					const untaken =
						stopped?.status === "waiting"
							? (
									await ctx.db
										.deleteFrom("run_inbox")
										.where("run_id", "=", input.run)
										.returning(["text", "created_at"])
										.execute()
								)
									.sort((a, b) => a.created_at.getTime() - b.created_at.getTime())
									.map((each) => each.text)
							: [];
					abortRun(input.run);
					return { stopped: stopped !== undefined, untaken };
				},
				summary: () => ({ key: "assistant.stop" }),
			}),
			defineOperation({
				name: "assistant.say",
				kind: "write",
				humanOnly: true,
				bookkeeping: true,
				description:
					"Say something more to a run that is going: it is taken into its next turn. If the run ends first, the run's end hands it back. Only a person does it.",
				input: z.object({ run: z.string(), text: z.string().trim().min(1).max(20_000) }),
				async run(input, ctx) {
					const run = await ctx.db.selectFrom("runs").select("status").where("id", "=", input.run).executeTakeFirst();
					if (run?.status !== "running" && run?.status !== "waiting") throw new CheckError({ key: "assistant.ended" });
					await ctx.db
						.insertInto("run_inbox")
						.values({ id: globalThis.crypto.randomUUID(), run_id: input.run, text: input.text, created_at: ctx.now() })
						.execute();
					return { queued: true };
				},
				summary: () => ({ key: "assistant.say" }),
			}),
			defineOperation({
				name: "conversations.list",
				kind: "read",
				description:
					"The past conversations, newest first, a page at a time: what was first asked, when it was last asked in, and what became of its proposal (waiting, applied, taken in a screen, reverted, discarded). `before` (the `earlier` of the page before) gives the next page.",
				input: z.object({
					limit: z.number().int().min(1).max(100).default(PAGE.conversations),
					before: Place.optional(),
				}),
				async run(
					input,
					ctx,
				): Promise<{ conversations: ConversationRow[]; earlier: Place | null; keepDays: number | null }> {
					// When it was last asked in; one nothing was asked in yet, when it was made.
					const at = sql<Date>`coalesce((select max(runs.started_at) from runs where runs.conversation_id = conversations.id and runs.kind = 'chat'), conversations.created_at)`;
					const rows = await ctx.db
						.selectFrom("conversations")
						.select(["id", "title"])
						.select(at.as("at"))
						.$if(input.before !== undefined, (query) =>
							query.where(
								sql<boolean>`(${at}, conversations.id) < (${new Date(input.before?.at ?? 0)}, ${input.before?.id ?? ""})`,
							),
						)
						.orderBy(at, "desc")
						.orderBy("id", "desc")
						// One more than the page: whether there is a next one.
						.limit(input.limit + 1)
						.execute();
					const page = rows.slice(0, input.limit);
					const found = await outcomes(
						ctx.db,
						page.map((row) => row.id),
					);
					return {
						conversations: page.map((row) => ({
							id: row.id,
							title: row.title,
							at: row.at,
							outcome: found.get(row.id) ?? null,
						})),
						earlier: rows.length > input.limit ? placeOf(page.at(-1)) : null,
						keepDays: await keepDaysOf(ctx.db),
					};
				},
			}),
			defineOperation({
				name: "conversations.get",
				kind: "read",
				description:
					"One conversation as the panel shows it: its newest requests, each with what the assistant said and did, the proposal it made, and how it ended. `before` (the `earlier` of the read before) gives the requests before those. Opening it counts as opened: its days start again.",
				input: z.object({
					id: z.string(),
					limit: z.number().int().min(1).max(100).default(PAGE.runs),
					before: Place.optional(),
				}),
				async run(input, ctx): Promise<Conversation> {
					const conversation = await ctx.db
						.selectFrom("conversations")
						.selectAll()
						.where("id", "=", input.id)
						.executeTakeFirst();
					if (!conversation) throw new CheckError({ key: "assistant.noConversation" });
					// Not a change of the site: the conversation's own clock, which the clean-up reads.
					await ctx.db
						.updateTable("conversations")
						.set({ last_opened_at: ctx.now() })
						.where("id", "=", input.id)
						.execute();
					const newest = await ctx.db
						.selectFrom("runs")
						.selectAll()
						.where("conversation_id", "=", input.id)
						.where("kind", "=", "chat")
						.$if(input.before !== undefined, (query) =>
							query.where(
								sql<boolean>`(started_at, id) < (${new Date(input.before?.at ?? 0)}, ${input.before?.id ?? ""})`,
							),
						)
						.orderBy("started_at", "desc")
						.orderBy("id", "desc")
						// One more than the page: whether there are requests before these.
						.limit(input.limit + 1)
						.execute();
					const runs = newest.slice(0, input.limit).reverse();
					const messages =
						runs.length === 0
							? []
							: await ctx.db
									.selectFrom("run_messages")
									.select(["run_id", "message"])
									.where(
										"run_id",
										"in",
										runs.map((run) => run.id),
									)
									.orderBy("position")
									.execute();
					return {
						id: conversation.id,
						title: conversation.title,
						model:
							conversation.key_id && conversation.model
								? { keyId: conversation.key_id, model: conversation.model }
								: null,
						thinking: conversation.thinking,
						earlier:
							newest.length > input.limit && runs[0] ? { at: runs[0].started_at.toISOString(), id: runs[0].id } : null,
						forgotten: await forgottenOf(ctx.db, conversation, limits, async (keyId, model) => {
							const listed = (await site().run("models.list", {}, { actor: "admin" })) as ModelList;
							return listed.keys.find((key) => key.id === keyId)?.models.find((each) => each.id === model)?.context;
						}),
						runs: runs.map((run) => {
							// A run whose request died (its hold ran out) reads as cut short: it can be gone on with.
							const dead = run.status === "running" && (run.leased_until === null || run.leased_until < ctx.now());
							return {
								id: run.id,
								status: dead ? "interrupted" : run.status,
								request: run.request,
								context: run.context,
								model: run.model,
								thinking: run.thinking,
								startedAt: run.started_at,
								parts: partsOf(
									messages
										.filter((message) => message.run_id === run.id)
										.map((message) => message.message as StoredMessage),
								),
								proposalId: run.proposal_id,
								end: dead ? { status: "interrupted", reason: "connection" } : (run.ended as RunEnd | null),
								usage: run.usage,
							};
						}),
					};
				},
			}),
			defineOperation({
				name: "conversations.remove",
				kind: "write",
				humanOnly: true,
				bookkeeping: true,
				description:
					"Remove a conversation, with its proposals that still wait. What was applied stays in the activity log. Only a person does it.",
				input: z.object({ id: z.string() }),
				async run(input, ctx) {
					// Held to the end: a request that starts a run in it meanwhile waits, and then finds no conversation.
					await ctx.db.selectFrom("conversations").select("id").where("id", "=", input.id).forUpdate().execute();
					// Not from under a run at work: it would go on proposing for a conversation that is gone. Stop it first.
					const working = await ctx.db
						.selectFrom("runs")
						.select("id")
						.where("conversation_id", "=", input.id)
						.where("status", "=", "running")
						.where("leased_until", ">=", ctx.now())
						.executeTakeFirst();
					if (working) throw new CheckError({ key: "assistant.busy" });
					await removeConversations(ctx.db, [input.id]);
					return { id: input.id };
				},
				summary: () => ({ key: "conversations.remove" }),
			}),
			defineOperation({
				name: "conversations.keep",
				kind: "write",
				humanOnly: true,
				description:
					"For how many days a conversation nobody opened is kept before it is removed: 7, 30 or 90, or `null` to keep them for good. Only a person does it.",
				input: z.object({ days: z.union([z.literal(7), z.literal(30), z.literal(90), z.null()]) }),
				async run(input, ctx) {
					await ctx.db
						.insertInto("assistant_settings")
						.values({ id: 1, keep_days: input.days })
						.onConflict((conflict) => conflict.column("id").doUpdateSet({ keep_days: input.days }))
						.execute();
					return { days: input.days };
				},
				summary: (input) =>
					input.days === null
						? { key: "conversations.keepAll" }
						: { key: "conversations.keep", values: { days: input.days } },
			}),
			defineOperation({
				name: "screen.openEntry",
				kind: "screen",
				description:
					"Open an entry in the editor for the person (its id from entries.query). If the screen has unsaved changes it does not move, and says so. No data changes.",
				input: z.object({ id: z.string() }),
				run: (): null => {
					throw new Error("screen.openEntry runs in the browser.");
				},
			}),
		],
	});
}
