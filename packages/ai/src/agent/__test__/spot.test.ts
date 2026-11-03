import type { Cms, WritePlan } from "@monti-cms/core/server";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { admin, notesSite } from "../../../test/notes-site";
import { itemOf } from "../proposals";
import { askAtSelection, askAtSpot } from "../spot";

const USAGE = {
	inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
	outputTokens: { total: 5, text: 5, reasoning: undefined },
};

/** A model that answers with `rewrite`, and remembers what it was asked. */
const modelAnswering = (text: string, reply: string) => {
	const prompts: string[] = [];
	const model = new MockLanguageModelV4({
		doGenerate: async ({ prompt }) => {
			prompts.push(JSON.stringify(prompt));
			return {
				content: [{ type: "tool-call", toolCallId: "c1", toolName: "rewrite", input: JSON.stringify({ text, reply }) }],
				finishReason: { unified: "tool-calls", raw: undefined },
				usage: USAGE,
				warnings: [],
			};
		},
	});
	return { model, prompts };
};

/** A proposal with one body change of entry `e1`, and a site whose body plan answers the edit as given. */
async function setUp() {
	const site = notesSite();
	await site.store.proposals.create("p", { adminId: admin.userId, runId: "run-p", request: "make it shorter" });
	await site.store.proposals.addItems(admin.userId, "p", [
		itemOf("i1", "entries.updateBody", {
			target: { kind: "entry", id: "e1", spot: "body:b1" },
			preview: { before: "I decided to rebuild the blog.", after: "I rebuilt the blog." },
			base: "x",
			change: { blockId: "b1", nodes: [], format: "paragraphs" },
		}),
	]);
	const plan = vi.fn(
		async (_operation: string, input: { edits: { find: string; replace: string }[] }): Promise<WritePlan[]> => {
			const [edit] = input.edits;
			if (!edit || edit.find === edit.replace) return [];
			return [
				{
					target: { kind: "entry", id: "e1", spot: "body:b1" },
					preview: { before: edit.find, after: edit.replace },
					base: "x",
					change: { blockId: "b1", nodes: [], format: "paragraphs" },
				},
			];
		},
	);
	const cms = { writes: { plan } } as unknown as Cms;
	return { site, cms, plan };
}

describe("a request in a change's card", () => {
	it("AGENT-S1 writes the block again from the card's words, puts the new change in the old one's place and keeps the thread", async () => {
		const { site, cms, plan } = await setUp();
		const { model, prompts } = modelAnswering("I made the blog again.", "Kept the end, changed the start.");
		const first = await askAtSpot({
			cms,
			auth: admin,
			store: site.store.proposals,
			model,
			proposalId: "p",
			itemId: "i1",
			text: "keep the end",
		});

		expect(plan).toHaveBeenCalledWith(
			"entries.updateBody",
			{
				id: "e1",
				format: "paragraphs",
				edits: [{ find: "I decided to rebuild the blog.", replace: "I made the blog again." }],
			},
			{ auth: admin },
		);
		expect(first.proposal.items).toHaveLength(1);
		const [changed] = first.proposal.items;
		expect(changed?.id).toBe(first.itemId);
		expect(changed?.id).not.toBe("i1");
		expect(changed?.preview.after).toBe("I made the blog again.");
		expect(changed?.thread?.map((message) => [message.author, message.text])).toEqual([
			["admin", "keep the end"],
			["assistant", "Kept the end, changed the start."],
		]);
		// The model was given the request, the block, its earlier proposal and the words.
		expect(prompts[0]).toContain("make it shorter");
		expect(prompts[0]).toContain("I rebuilt the blog.");

		const again = modelAnswering("I made it again.", "Shorter.");
		const second = await askAtSpot({
			cms,
			auth: admin,
			store: site.store.proposals,
			model: again.model,
			proposalId: "p",
			itemId: first.itemId,
			text: "shorter",
		});
		expect(second.proposal.items[0]?.thread).toHaveLength(4);
		expect(again.prompts[0]).toContain("Kept the end, changed the start.");
	});

	it("AGENT-S1 leaves the change out when the answer is the block as it is", async () => {
		const { site, cms } = await setUp();
		const { model } = modelAnswering("I decided to rebuild the blog.", "Left it as it was.");
		const { proposal } = await askAtSpot({
			cms,
			auth: admin,
			store: site.store.proposals,
			model,
			proposalId: "p",
			itemId: "i1",
			text: "leave it",
		});
		expect(proposal.items[0]).toMatchObject({ id: "i1", included: false });
		expect(proposal.items[0]?.thread?.at(-1)?.text).toBe("Left it as it was.");
	});
});

describe("a request in a field change's card", () => {
	it("AGENT-S1 writes a text field again from the card's words, and plans it as a field change", async () => {
		const site = notesSite();
		await site.store.proposals.create("p", { adminId: admin.userId, runId: "run-p", request: "summarize" });
		await site.store.proposals.addItems(admin.userId, "p", [
			itemOf("f1", "entries.updateFields", {
				target: { kind: "entry", id: "e1", spot: "summary" },
				preview: { before: null, after: "A long summary of the post." },
				base: "x",
				change: { field: "summary", value: "A long summary of the post." },
			}),
		]);
		const plan = vi.fn(
			async (_operation: string, input: { fields: Record<string, string> }): Promise<WritePlan[]> => [
				{
					target: { kind: "entry", id: "e1", spot: "summary" },
					preview: { before: null, after: input.fields.summary },
					base: "x",
					change: { field: "summary", value: input.fields.summary },
				},
			],
		);
		const cms = { writes: { plan } } as unknown as Cms;
		const { model, prompts } = modelAnswering("A short summary.", "Shortened it.");
		const { proposal, itemId } = await askAtSpot({
			cms,
			auth: admin,
			store: site.store.proposals,
			model,
			proposalId: "p",
			itemId: "f1",
			text: "shorter",
		});
		expect(plan).toHaveBeenCalledWith(
			"entries.updateFields",
			{ id: "e1", fields: { summary: "A short summary." } },
			{ auth: admin },
		);
		expect(proposal.items[0]).toMatchObject({ id: itemId, change: { value: "A short summary." } });
		expect(proposal.items[0]?.thread?.map((message) => message.text)).toEqual(["shorter", "Shortened it."]);
		expect(prompts[0]).toContain("A long summary of the post.");
	});
});

describe("a request in a media tile's card", () => {
	it("AGENT-S1 writes a media file's alt text again, and plans it as a media text change", async () => {
		const site = notesSite();
		await site.store.proposals.create("p", { adminId: admin.userId, runId: "run-p", request: "alt texts" });
		await site.store.proposals.addItems(admin.userId, "p", [
			itemOf("m1", "media.updateText", {
				target: { kind: "media", id: "media-1", spot: "defaultAlt" },
				preview: { before: null, after: "A laptop and coffee on a desk." },
				base: "x",
				change: { spot: "defaultAlt", value: "A laptop and coffee on a desk." },
			}),
		]);
		const plan = vi.fn(
			async (_operation: string, input: { items: { id: string; alt: string }[] }): Promise<WritePlan[]> => [
				{
					target: { kind: "media", id: "media-1", spot: "defaultAlt" },
					preview: { before: null, after: input.items[0]?.alt ?? "" },
					base: "x",
					change: { spot: "defaultAlt", value: input.items[0]?.alt ?? "" },
				},
			],
		);
		const cms = { writes: { plan } } as unknown as Cms;
		const { model } = modelAnswering("An open notebook and a pencil on a desk.", "Fixed it.");
		const { proposal } = await askAtSpot({
			cms,
			auth: admin,
			store: site.store.proposals,
			model,
			proposalId: "p",
			itemId: "m1",
			text: "it is a notebook, no coffee",
		});
		expect(plan).toHaveBeenCalledWith(
			"media.updateText",
			{ items: [{ id: "media-1", alt: "An open notebook and a pencil on a desk." }] },
			{ auth: admin },
		);
		expect(proposal.items[0]?.thread?.map((message) => message.text)).toEqual([
			"it is a notebook, no coffee",
			"Fixed it.",
		]);
	});
});

describe("a request on selected words", () => {
	const BLOCK = "I kept the settings screen as it was. It changes rarely.";

	/** A site whose body plan finds text in the one block `b2` and answers each edit as given. */
	const setUpBlock = () => {
		const site = notesSite();
		const plan = vi.fn(
			async (_operation: string, input: { edits: { find: string; replace: string }[] }): Promise<WritePlan[]> => {
				const [edit] = input.edits;
				if (!edit || !BLOCK.includes(edit.find)) throw new Error("No block of the body holds the text");
				const after = BLOCK.replace(edit.find, edit.replace);
				if (after === BLOCK) return [];
				return [
					{
						target: { kind: "entry", id: "e1", spot: "body:b2" },
						preview: { before: BLOCK, after },
						base: "x",
						change: { blockId: "b2", nodes: [], format: "paragraphs" },
					},
				];
			},
		);
		const formats = async () => ({ list: () => [{ name: "paragraphs" }] });
		const cms = { writes: { plan }, formats } as unknown as Cms;
		return { site, cms, plan };
	};

	it("AGENT-S2 rewrites the block that holds the words, as a proposal of its own named by the request, with the two messages", async () => {
		const { site, cms, plan } = setUpBlock();
		const { model, prompts } = modelAnswering("I kept the settings screen: it changes rarely.", "Joined the two.");
		const { proposal, itemId } = await askAtSelection({
			cms,
			auth: admin,
			store: site.store.proposals,
			model,
			entryId: "e1",
			words: "I kept the settings screen as it was.",
			text: "join it with the next sentence",
		});

		expect(plan).toHaveBeenLastCalledWith(
			"entries.updateBody",
			{
				id: "e1",
				format: "paragraphs",
				edits: [{ find: BLOCK, replace: "I kept the settings screen: it changes rarely." }],
			},
			{ auth: admin },
		);
		expect(proposal).toMatchObject({ request: "join it with the next sentence", status: "pending" });
		expect(proposal.items).toHaveLength(1);
		expect(proposal.items[0]?.id).toBe(itemId);
		expect(proposal.items[0]?.thread?.map((message) => [message.author, message.text])).toEqual([
			["admin", "join it with the next sentence"],
			["assistant", "Joined the two."],
		]);
		// The model was given the whole block and the selected words.
		expect(prompts[0]).toContain(BLOCK);
		expect(prompts[0]).toContain("I kept the settings screen as it was.");
		expect(await site.store.proposals.pendingFor(admin.userId, "e1")).toHaveLength(1);
	});

	it("AGENT-S2 proposes nothing when the answer is the block as it is", async () => {
		const { site, cms } = setUpBlock();
		const { model } = modelAnswering(BLOCK, "Left it.");
		const { proposal, itemId } = await askAtSelection({
			cms,
			auth: admin,
			store: site.store.proposals,
			model,
			entryId: "e1",
			words: "It changes rarely.",
			text: "leave it",
		});
		expect(itemId).toBeNull();
		expect(proposal.status).toBe("discarded");
		expect(await site.store.proposals.pendingFor(admin.userId, "e1")).toHaveLength(0);
	});

	it("AGENT-S2 refuses words that are not in the body, before asking the model", async () => {
		const { site, cms } = setUpBlock();
		const { model, prompts } = modelAnswering("x", "y");
		await expect(
			askAtSelection({
				cms,
				auth: admin,
				store: site.store.proposals,
				model,
				entryId: "e1",
				words: "nowhere",
				text: "fix",
			}),
		).rejects.toThrow();
		expect(prompts).toHaveLength(0);
	});
});
