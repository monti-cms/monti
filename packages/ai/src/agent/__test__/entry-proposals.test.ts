import type { Cms } from "@monti-cms/core/server";
import { describe, expect, it } from "vitest";
import { admin, notesSite } from "../../../test/notes-site";
import { discardProposal, revertProposal } from "../apply";
import { proposalsForEntry, settleInEditor } from "../entry-proposals";
import { itemOf } from "../proposals";

describe("the proposals an entry editor shows", () => {
	it("AGENT-E2 lists the waiting proposals that change the entry, marks a spot a person changed as stale, and leaves out settled ones and other entries", async () => {
		const site = notesSite({ a: "one", b: "two" });
		const propose = async (id: string, note: string, text: string) => {
			await site.store.proposals.create(id, { adminId: admin.userId, runId: `run-${id}`, request: "fix" });
			return site.store.proposals.addItems(admin.userId, id, [
				itemOf(`${id}-i`, "notes.set", {
					target: { kind: "entry", id: note, spot: "text" },
					preview: { before: site.notes.get(note), after: text },
					base: site.notes.get(note) ?? "",
					change: { text },
				}),
			]);
		};
		await propose("p1", "a", "ONE");
		await propose("p2", "b", "TWO");
		await propose("p3", "a", "Uno");
		await discardProposal(admin, site.store.proposals, "p3");
		await site.store.proposals.create("other", { adminId: "someone-else", runId: "r", request: "" });

		const cms = site.cms as unknown as Cms;
		const found = await proposalsForEntry(cms, admin, site.store.proposals, "a");
		expect(found.map((proposal) => [proposal.id, proposal.items[0]?.state])).toEqual([["p1", "pending"]]);

		site.notes.set("a", "one, edited by a person");
		const [stale] = await proposalsForEntry(cms, admin, site.store.proposals, "a");
		expect(stale?.items[0]).toMatchObject({ state: "stale", reason: "changed" });
	});

	it("AGENT-E3 records items accepted in the editor as applied and discarded ones as left out, settles the proposal when none waits, and undoes the accepted ones", async () => {
		const site = notesSite({ a: "one", b: "two", c: "three" });
		await site.store.proposals.create("p", { adminId: admin.userId, runId: "run-p", request: "fix" });
		await site.store.proposals.addItems(
			admin.userId,
			"p",
			["a", "b", "c"].map((note) =>
				itemOf(`i-${note}`, "notes.set", {
					target: { kind: "entry", id: note, spot: "text" },
					preview: { before: site.notes.get(note), after: note.toUpperCase() },
					base: site.notes.get(note) ?? "",
					change: { text: note.toUpperCase() },
				}),
			),
		);
		const cms = site.cms as unknown as Cms;
		// The editor wrote "A" and saved; "b" was discarded; "c" still waits.
		site.notes.set("a", "A");
		const partly = await settleInEditor(cms, admin, site.store.proposals, "p", {
			accepted: [{ id: "i-a" }],
			discarded: ["i-b"],
		});
		expect(partly.status).toBe("pending");
		expect(partly.items.map((item) => [item.state, item.included])).toEqual([
			["applied", true],
			["pending", false],
			["pending", true],
		]);
		expect(partly.items[0]?.applied?.inEditor).toBe(true);

		const settled = await settleInEditor(cms, admin, site.store.proposals, "p", { discarded: ["i-c"] });
		expect(settled).toMatchObject({ status: "applied" });
		const undone = await revertProposal(cms, admin, site.store.proposals, "p");
		expect(undone.status).toBe("reverted");
		expect(site.notes.get("a")).toBe("one");
	});
});
