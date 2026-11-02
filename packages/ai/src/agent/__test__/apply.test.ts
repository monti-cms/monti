import type { Cms } from "@monti-cms/core/server";
import { describe, expect, it } from "vitest";
import { admin, notesSite } from "../../../test/notes-site";
import { applyProposal, discardProposal, includeItems, refreshStale, revertProposal } from "../apply";
import { itemOf } from "../proposals";

/** A proposal of run `run-1` changing each named note to the given text. */
async function propose(site: ReturnType<typeof notesSite>, changes: Record<string, string>) {
	const id = `p-${Object.keys(changes).join("")}`;
	await site.store.proposals.create(id, { adminId: admin.userId, runId: "run-1", request: "change notes" });
	const items = Object.entries(changes).map(([note, text], index) =>
		itemOf(`i${index}`, "notes.set", {
			target: { kind: "entry", id: note, spot: "text" },
			preview: { before: site.notes.get(note), after: text },
			base: site.notes.get(note) ?? "",
			change: { text },
		}),
	);
	return site.store.proposals.addItems(admin.userId, id, items);
}
const asCms = (site: ReturnType<typeof notesSite>) => site.cms as unknown as Cms;

describe("applying a proposal", () => {
	it("AGENT-A1 applies the included items one by one as the agent's change, reports each step, and keeps going past one that fails", async () => {
		const site = notesSite({ a: "one", broken: "x", c: "three" });
		const proposal = await propose(site, { a: "ONE", broken: "X", c: "THREE" });
		const steps: number[] = [];
		const done = await applyProposal(asCms(site), admin, site.store.proposals, proposal.id, ({ done }) =>
			steps.push(done),
		);
		expect(steps).toEqual([1, 2, 3]);
		expect([site.notes.get("a"), site.notes.get("broken"), site.notes.get("c")]).toEqual(["ONE", "x", "THREE"]);
		expect(done.status).toBe("partial");
		expect(done.items.map((item) => [item.state, item.reason ?? null])).toEqual([
			["applied", null],
			["failed", "invalid_status"],
			["applied", null],
		]);
		expect(site.seen).toEqual([
			{ runId: "run-1", proposalId: proposal.id },
			{ runId: "run-1", proposalId: proposal.id },
		]);
	});

	it("AGENT-A2 leaves out items the admin excluded and items whose target changed since the plan, and marks the changed ones when the review opens", async () => {
		const site = notesSite({ a: "one", b: "two", c: "three" });
		const proposal = await propose(site, { a: "ONE", b: "TWO", c: "THREE" });
		await includeItems(admin, site.store.proposals, proposal.id, { i2: false });
		site.notes.set("b", "two, edited by a person");
		const reviewed = await refreshStale(asCms(site), admin, site.store.proposals, proposal);
		expect(reviewed.items.map((item) => item.state)).toEqual(["pending", "stale", "pending"]);

		const done = await applyProposal(asCms(site), admin, site.store.proposals, proposal.id);
		expect([site.notes.get("a"), site.notes.get("b"), site.notes.get("c")]).toEqual([
			"ONE",
			"two, edited by a person",
			"three",
		]);
		expect(done.items.map((item) => item.state)).toEqual(["applied", "stale", "pending"]);
		expect(done.status).toBe("partial");
	});

	it("AGENT-A3 undoes the applied items but leaves alone one a person changed after it was applied", async () => {
		const site = notesSite({ a: "one", b: "two" });
		const proposal = await propose(site, { a: "ONE", b: "TWO" });
		await applyProposal(asCms(site), admin, site.store.proposals, proposal.id);
		site.notes.set("b", "TWO, then a person's edit");
		const undone = await revertProposal(asCms(site), admin, site.store.proposals, proposal.id);
		expect([site.notes.get("a"), site.notes.get("b")]).toEqual(["one", "TWO, then a person's edit"]);
		expect(undone.status).toBe("reverted");
		expect(undone.items.map((item) => item.state)).toEqual(["reverted", "kept"]);
	});

	it("AGENT-A4 discards a waiting proposal without changing anything, and settles it so it can no longer be applied", async () => {
		const site = notesSite({ a: "one" });
		const proposal = await propose(site, { a: "ONE" });
		expect((await discardProposal(admin, site.store.proposals, proposal.id)).status).toBe("discarded");
		await expect(applyProposal(asCms(site), admin, site.store.proposals, proposal.id)).rejects.toMatchObject({
			code: "invalid_status",
		});
		expect(site.notes.get("a")).toBe("one");
	});

	it("AGENT-A1 applied again after a cut does only what was left", async () => {
		const site = notesSite({ a: "one", b: "two" });
		const proposal = await propose(site, { a: "ONE", b: "TWO" });
		// A cut after the first item: it is stored as applied, the proposal as applying.
		await site.store.proposals.update(admin.userId, proposal.id, (current) => ({
			...current,
			status: "applying",
			items: current.items.map((item, index) =>
				index === 0 ? { ...item, state: "applied", applied: { base: "ONE", undo: { text: "one" }, at: "" } } : item,
			),
		}));
		site.notes.set("a", "ONE");
		const steps: number[] = [];
		const done = await applyProposal(asCms(site), admin, site.store.proposals, proposal.id, ({ total }) =>
			steps.push(total),
		);
		expect(steps).toEqual([1]);
		expect(done.status).toBe("applied");
		expect(site.notes.get("b")).toBe("TWO");
	});
});
