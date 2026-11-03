import { randomUUID } from "node:crypto";
import { type AdminRequest, type Cms, CmsError } from "@monti-cms/core/server";
import { generateText, type LanguageModel, tool } from "ai";
import { z } from "zod";
import { itemOf, type Proposal, type ProposalItem, type ProposalStore, type SpotMessage } from "./proposals";

/** The one tool of a spot request: the block's new text and what the assistant says about it. */
const rewriteInput = z.object({
	text: z.string().describe("The whole new text of the block, in the body format; empty removes the block"),
	reply: z.string().describe("One short sentence to the admin, in their language, saying what you changed"),
});

const system = (format: string, rules: string | null) =>
	[
		"You change one block of an entry's body again, as the admin asks in the card on that block.",
		`Answer only by calling \`rewrite\` with the block's whole new text, written in the ${format} format, and a one-sentence reply.`,
		"Change only what the admin asks; keep the rest of your earlier proposal. The reply is in the admin's language, plain and short.",
		...(rules ? ["", "The site's writing rules:", rules] : []),
	].join("\n");

const selectionSystem = (format: string, rules: string | null) =>
	[
		"You change one block of an entry's body, as the admin asks about some words they selected in it.",
		`Answer only by calling \`rewrite\` with the block's whole new text, written in the ${format} format, and a one-sentence reply.`,
		"Change the selected words as asked and only what the request needs around them; keep the rest of the block as it is. The reply is in the admin's language, plain and short.",
		...(rules ? ["", "The site's writing rules:", rules] : []),
	].join("\n");

const prompt = (input: {
	request: string;
	current: string;
	proposed: string | null;
	thread: readonly SpotMessage[];
	text: string;
}) =>
	[
		`The request the proposal came from: ${input.request}`,
		"",
		"The block as it is now:",
		input.current,
		"",
		"Your earlier proposal for it:",
		input.proposed ?? "(remove the block)",
		...(input.thread.length > 0
			? [
					"",
					"What was said in the card so far:",
					...input.thread.map((message) => `${message.author}: ${message.text}`),
				]
			: []),
		"",
		`The admin now asks: ${input.text}`,
	].join("\n");

/** Asks the model for a block's new text with the one `rewrite` tool, which it must call. */
async function rewrite({
	model,
	system,
	prompt,
	recordUsage,
	signal,
}: {
	model: LanguageModel;
	system: string;
	prompt: string;
	recordUsage?: (tokens: number) => Promise<void>;
	signal?: AbortSignal;
}): Promise<z.infer<typeof rewriteInput>> {
	const result = await generateText({
		model,
		system,
		prompt,
		tools: { rewrite: tool({ description: "The block's new text and the reply", inputSchema: rewriteInput }) },
		toolChoice: { type: "tool", toolName: "rewrite" },
		maxRetries: 1,
		abortSignal: signal,
	});
	await recordUsage?.(result.totalUsage.totalTokens ?? 0);
	const call = result.toolCalls.find((candidate) => candidate.toolName === "rewrite");
	const answer = rewriteInput.safeParse(call?.input);
	if (!answer.success) throw new CmsError("The assistant did not answer with a new text", "upstream_failed");
	return answer.data;
}

export interface AskAtSpot {
	readonly cms: Cms;
	readonly auth: AdminRequest["auth"];
	readonly store: ProposalStore;
	/** The assistant's model; it is made to answer with the `rewrite` tool. */
	readonly model: LanguageModel;
	readonly proposalId: string;
	readonly itemId: string;
	/** What the admin wrote in the card. */
	readonly text: string;
	/** The site's writing rules, if any. */
	readonly rules?: string | null;
	readonly recordUsage?: (tokens: number) => Promise<void>;
	readonly signal?: AbortSignal;
}

/**
 * A request in the card of one change (docs/design/agent.md §7, flow 2 · 09): a small run whose context is that block, the change and the card's thread.
 * The assistant writes the block again; the new change takes the old one's place in the proposal, under a new id, with the thread kept and the two new
 * messages added. When its answer is the block as it is, the change is left out (there is nothing to propose any more).
 */
export async function askAtSpot({
	cms,
	auth,
	store,
	model,
	proposalId,
	itemId,
	text,
	rules = null,
	recordUsage,
	signal,
}: AskAtSpot): Promise<{ proposal: Proposal; itemId: string }> {
	const proposal = await store.get(auth.userId, proposalId);
	if (!proposal) throw new CmsError("No such proposal", "not_found");
	if (proposal.status !== "pending") throw new CmsError("The proposal is no longer open", "invalid_status");
	const item = proposal.items.find((candidate) => candidate.id === itemId);
	if (!item || item.state !== "pending") throw new CmsError("No waiting change with this id", "not_found");
	if (item.operation !== "entries.updateBody")
		throw new CmsError("Only a body change can be asked about here", "invalid_input");
	const { format } = item.change as { format: string };
	const current = typeof item.preview.before === "string" ? item.preview.before : "";
	const proposed = typeof item.preview.after === "string" ? item.preview.after : null;
	const thread = item.thread ?? [];

	const answer = await rewrite({
		model,
		system: system(format, rules),
		prompt: prompt({ request: proposal.request, current, proposed, thread, text }),
		recordUsage,
		signal,
	});

	// Planned against the block as it is stored now: if it changed since the first plan, this is refused like any stale change.
	const plans = await cms.writes.plan(
		"entries.updateBody",
		{ id: item.target.id, format, edits: [{ find: current, replace: answer.text }] },
		{ auth },
	);
	const at = new Date().toISOString();
	const said: SpotMessage[] = [
		...thread,
		{ author: "admin", text, at },
		{ author: "assistant", text: answer.reply, at },
	];
	const [plan] = plans;
	const next: ProposalItem = plan
		? { ...itemOf(randomUUID(), item.operation, plan), thread: said }
		: { ...item, included: false, thread: said };
	const updated = await store.update(auth.userId, proposalId, (now) => {
		if (now.status !== "pending") throw new CmsError("The proposal is no longer open", "invalid_status");
		return { ...now, items: now.items.map((candidate) => (candidate.id === itemId ? next : candidate)) };
	});
	return { proposal: updated, itemId: next.id };
}

export interface AskAtSelection {
	readonly cms: Cms;
	readonly auth: AdminRequest["auth"];
	readonly store: ProposalStore;
	readonly model: LanguageModel;
	readonly entryId: string;
	/** The words the admin selected, as they read in the body (plain text); they must lie in one block. */
	readonly words: string;
	/** What the admin wrote in the card. */
	readonly text: string;
	/** The body format the block is written in for the model; the site's first format when not given. */
	readonly format?: string;
	readonly rules?: string | null;
	readonly recordUsage?: (tokens: number) => Promise<void>;
	readonly signal?: AbortSignal;
}

/**
 * A request on words the admin selected in the editor (docs/design/agent-editor.md, step 3b; flow 2 · 09b–c): a small run whose context is the block that
 * holds the words. It makes a proposal of its own with one body change, the admin's request as its name and the two messages as the change's thread. The
 * block is read as stored, so the editor saves first. Resolves with the proposal and the change's id, or a `null` id when the answer is the block as it
 * is (the proposal is then discarded at once: there is nothing to review).
 */
export async function askAtSelection({
	cms,
	auth,
	store,
	model,
	entryId,
	words,
	text,
	format: asked,
	rules = null,
	recordUsage,
	signal,
}: AskAtSelection): Promise<{ proposal: Proposal; itemId: string | null }> {
	const format = asked ?? (await cms.formats()).list()[0]?.name;
	if (!format) throw new CmsError("The site has no body format to write in", "invalid_input");
	// Planning the words away finds the one block that holds them and gives its whole text, as the model will rewrite it.
	const [probe] = await cms.writes.plan(
		"entries.updateBody",
		{ id: entryId, format, edits: [{ find: words, replace: "" }] },
		{ auth },
	);
	const current = typeof probe?.preview.before === "string" ? probe.preview.before : null;
	if (current === null) throw new CmsError("The selected words are not in one block of the body", "invalid_input");

	const answer = await rewrite({
		model,
		system: selectionSystem(format, rules),
		prompt: [
			`The block as it is now:`,
			current,
			"",
			`The words the admin selected in it: ${words}`,
			"",
			`The admin asks: ${text}`,
		].join("\n"),
		recordUsage,
		signal,
	});
	const [plan] = await cms.writes.plan(
		"entries.updateBody",
		{ id: entryId, format, edits: [{ find: current, replace: answer.text }] },
		{ auth },
	);
	const at = new Date().toISOString();
	const thread: SpotMessage[] = [
		{ author: "admin", text, at },
		{ author: "assistant", text: answer.reply, at },
	];
	const id = randomUUID();
	await store.create(id, { adminId: auth.userId, runId: "", request: text });
	if (!plan) {
		const proposal = await store.update(auth.userId, id, (now) => ({ ...now, status: "discarded", settledAt: at }));
		return { proposal, itemId: null };
	}
	const itemId = randomUUID();
	const proposal = await store.addItems(auth.userId, id, [{ ...itemOf(itemId, "entries.updateBody", plan), thread }]);
	return { proposal, itemId };
}
