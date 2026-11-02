import type { Cms } from "@monti-cms/core/server";
import { describe, expect, it } from "vitest";
import { admin, notesSite } from "../../../test/notes-site";
import { discardProposal } from "../apply";
import { proposalsForEntry } from "../entry-proposals";
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
});
