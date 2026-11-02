import type { Cms, WritePlan } from "@monti-cms/core/server";
import { MockLanguageModelV4 } from "ai/test";
import { describe, expect, it, vi } from "vitest";
import { admin, notesSite } from "../../../test/notes-site";
import { itemOf } from "../proposals";
import { askAtSpot } from "../spot";

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
