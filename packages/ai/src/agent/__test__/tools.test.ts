import type { Cms } from "@monti-cms/core/server";
import { describe, expect, it } from "vitest";
import type { Proposal } from "../proposals";
import { createAgentTools } from "../tools";
import { admin, notesSite } from "./fixture";

/** Runs one tool of the agent the way the SDK does, with the input the model gave. */
const call = (tools: Awaited<ReturnType<typeof createAgentTools>>, name: string, input: unknown) =>
	(tools[name]?.execute as (input: unknown, options: unknown) => Promise<unknown>)(input, {
		toolCallId: name,
		messages: [],
	});

describe("agent tools", () => {
	it("AGENT-P1 turn a write into items of the run's one proposal and change nothing, and later reads see the items applied", async () => {
		const { cms, store, notes } = notesSite();
		const sent: Proposal[] = [];
		const tools = await createAgentTools({
			cms: cms as unknown as Cms,
			auth: admin,
			run: {
				adminId: admin.userId,
				runId: "run-1",
				request: "fix the notes",
				proposals: store.proposals,
				onProposal: (p) => sent.push(p),
			},
		});
		const first = (await call(tools, "notes_set", { items: [{ id: "a", text: "ONE" }] })) as {
			proposalId: string;
			proposed: number;
		};
		await call(tools, "notes_set", {
			items: [
				{ id: "b", text: "TWO" },
				{ id: "a", text: "ONE" },
			],
		});
		expect(first.proposed).toBe(1);
		expect(notes.get("a")).toBe("one");

		const [proposal] = await store.proposals.ofRun(admin.userId, "run-1");
		expect(proposal).toMatchObject({ id: first.proposalId, request: "fix the notes", status: "pending" });
		expect(proposal?.items.map((item) => [item.target.id, item.preview.after])).toEqual([
			["a", "ONE"],
			["b", "TWO"],
			// Planned against the store, which still says "one": a second item for the same note.
			["a", "ONE"],
		]);
		expect(sent.map((p) => p.items.length)).toEqual([1, 3]);

		const read = (await call(tools, "notes_list", {})) as { items: { id: string; metadata: { text: string } }[] };
		expect(read.items.map((item) => item.metadata.text)).toEqual(["ONE", "TWO"]);
	});

	it("AGENT-P1 answer a write that would change nothing, or cannot be done, without a proposal", async () => {
		const { cms, store } = notesSite();
		const tools = await createAgentTools({
			cms: cms as unknown as Cms,
			auth: admin,
			run: { adminId: admin.userId, runId: "run-2", request: "", proposals: store.proposals },
		});
		expect(await call(tools, "notes_set", { items: [{ id: "a", text: "one" }] })).toMatchObject({ proposed: 0 });
		expect(await call(tools, "notes_set", { items: [{ id: "nope", text: "x" }] })).toMatchObject({
			error: { code: "not_found" },
		});
		expect(await store.proposals.ofRun(admin.userId, "run-2")).toEqual([]);
	});
});
