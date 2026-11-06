import { describe, expect, it } from "vitest";
import { acceptedAfterRevert, parseStored } from "./use-draft";
import type { ProposalItem } from "./use-proposals";

describe("stored drafts", () => {
	it("keeps valid browser drafts and ignores malformed data", () => {
		expect(parseStored({ version: 2, mine: [["title", "Draft"]], accepted: ["proposal-1"] })).toEqual({
			version: 2,
			mine: [["title", "Draft"]],
			accepted: ["proposal-1"],
		});
		expect(parseStored({})).toBeNull();
		expect(parseStored({ version: 2, mine: ["title"], accepted: [] })).toBeNull();
	});

	it("stops attributing a proposal after all of its changed paths are reverted", () => {
		const item = { id: "proposal-1" } as ProposalItem;
		const values = () => ({ title: "Proposed", slug: "proposed" });
		expect(acceptedAfterRevert([item.id], [item], values, "title", new Map([["slug", "proposed"]]))).toEqual([item.id]);
		expect(acceptedAfterRevert([item.id], [item], values, "slug", new Map())).toEqual([]);
	});
});
