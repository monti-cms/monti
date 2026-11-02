import { describe, expect, it } from "vitest";
import { outcomeOf } from "../outcome";
import type { Proposal, ProposalItem } from "../proposals";

const proposal = (status: Proposal["status"], states: ProposalItem["state"][] = []): Proposal =>
	({
		id: status,
		adminId: "u",
		runId: "r",
		request: "",
		status,
		items: states.map((state, index) => ({ id: String(index), state })),
		createdAt: new Date(),
		updatedAt: new Date(),
	}) as unknown as Proposal;

describe("what came of a conversation", () => {
	it("ASSIST-H3 is told by its latest proposal: waiting, applied with how many, undone or discarded; nothing for a conversation that proposed nothing", () => {
		expect(outcomeOf([])).toBeUndefined();
		expect(outcomeOf([proposal("pending")])).toEqual({ kind: "pending" });
		expect(outcomeOf([proposal("pending"), proposal("partial", ["applied", "failed", "applied"])])).toEqual({
			kind: "applied",
			count: 2,
		});
		expect(outcomeOf([proposal("reverted")])).toEqual({ kind: "reverted" });
		expect(outcomeOf([proposal("discarded")])).toEqual({ kind: "discarded" });
	});
});
