import type { Cms } from "@monti-cms/core/server";
import { describe, expect, it } from "vitest";
import { admin, notesSite } from "../../../test/notes-site";
import { discardProposal, revertProposal } from "../apply";
import { editorProposalViews, mediaProposalViews, proposalsForEntry, settleInEditor } from "../entry-proposals";
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

	it("AGENT-E4 gives the editor the body and field changes of the entry, each with what it needs to be drawn, and leaves out other operations", () => {
		const at = { kind: "entry" as const, id: "e1" };
		const proposal = {
			id: "p",
			adminId: admin.userId,
			runId: "run-p",
			request: "tidy",
			status: "pending" as const,
			createdAt: new Date(),
			updatedAt: new Date(),
			items: [
				itemOf("body", "entries.updateBody", {
					target: { ...at, spot: "body:b1" },
					preview: { before: "x", after: "y" },
					base: "b",
					change: { blockId: "b1", block: { type: "paragraph" }, nodes: [] },
				}),
				itemOf("summary", "entries.updateFields", {
					target: { ...at, spot: "summary" },
					preview: { before: null, after: "A short summary." },
					base: "s",
					change: { field: "summary", value: "A short summary." },
				}),
				itemOf("folder", "entries.moveToFolder", {
					target: at,
					preview: { before: null, after: "f" },
					base: "f",
					change: {},
				}),
			],
		};
		expect(editorProposalViews([proposal], "e1").map((view) => [view.kind, view.id])).toEqual([
			["body", "body"],
			["field", "summary"],
		]);
		expect(editorProposalViews([proposal], "e1")[1]).toMatchObject({
			field: "summary",
			before: null,
			value: "A short summary.",
		});
	});

	it("AGENT-E5 applies items accepted where nothing waits for a save at once, and records one that fails with its reason", async () => {
		const site = notesSite({ a: "one", b: "two" });
		await site.store.proposals.create("p", { adminId: admin.userId, runId: "run-p", request: "fix" });
		await site.store.proposals.addItems(
			admin.userId,
			"p",
			["a", "b"].map((note) =>
				itemOf(`i-${note}`, "notes.set", {
					target: { kind: "entry", id: note, spot: "text" },
					preview: { before: site.notes.get(note), after: note.toUpperCase() },
					base: site.notes.get(note) ?? "",
					change: { text: note.toUpperCase() },
				}),
			),
		);
		// "b" was written over by a person, so applying it is refused.
		site.notes.set("b", "two, by a person");
		const cms = site.cms as unknown as Cms;
		const settled = await settleInEditor(cms, admin, site.store.proposals, "p", { applied: ["i-a", "i-b"] });
		expect(site.notes.get("a")).toBe("A");
		expect(settled.items.map((item) => [item.id, item.state])).toEqual([
			["i-a", "applied"],
			["i-b", "failed"],
		]);
		expect(settled.items[0]?.applied?.inEditor).toBeUndefined();
		expect(settled.status).toBe("applied");
	});

	it("AGENT-E5 gives the media library the alt text changes, and leaves captions and other operations to the review", () => {
		const media = (id: string, spot: string, value: string) =>
			itemOf(id, "media.updateText", {
				target: { kind: "media", id: `m-${id}`, spot },
				preview: { before: null, after: value },
				base: "b",
				change: { spot, value },
			});
		const proposal = {
			id: "p",
			adminId: admin.userId,
			runId: "run-p",
			request: "alt texts",
			status: "pending" as const,
			createdAt: new Date(),
			updatedAt: new Date(),
			items: [media("alt", "defaultAlt", "A desk by the window."), media("cap", "defaultCaption", "Morning.")],
		};
		expect(mediaProposalViews([proposal])).toEqual([
			expect.objectContaining({ id: "alt", mediaId: "m-alt", before: null, value: "A desk by the window." }),
		]);
	});
});
