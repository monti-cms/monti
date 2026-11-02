import { describe, expect, it } from "vitest";
import { overlay } from "../overlay";
import { itemOf } from "../proposals";

describe("reads with the run's items applied", () => {
	it("AGENT-P1 reads an entry's body with a planned block change in place, and leaves another entry alone", () => {
		const item = itemOf("i1", "entries.updateBody", {
			target: { kind: "entry", id: "e1", spot: "body:b1" },
			preview: { before: "I decided to rebuild the blog.", after: "I rebuilt the blog." },
			base: "x",
			change: {},
		});
		const removal = itemOf("i2", "entries.updateBody", {
			target: { kind: "entry", id: "e1", spot: "body:b2" },
			preview: { before: "Settings stayed.", after: null },
			base: "x",
			change: {},
		});
		const read = {
			items: [
				{ id: "e1", working: { body: "I decided to rebuild the blog.\n\nSettings stayed." } },
				{ id: "e2", working: { body: "I decided to rebuild the blog." } },
			],
		};
		expect(overlay(read, [item, removal]).items.map((entry) => entry.working.body)).toEqual([
			"I rebuilt the blog.",
			"I decided to rebuild the blog.",
		]);
		expect(read.items[0]?.working.body).toBe("I decided to rebuild the blog.\n\nSettings stayed.");
	});
});
