import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { compareHref, compareModeOf } from "../compare-address";

describe("compare address", () => {
	it("WRITE-C3 is the edit address with the mode in its query, and reads the mode back", () => {
		const href = compareHref(testSite, "entry-1", "conflict");
		expect(href).toBe(`${testSite.adminEntryEditHref("entry-1")}?compare=conflict`);
		expect(compareModeOf(new URL(href, "http://localhost").searchParams)).toBe("conflict");
		expect(compareModeOf(new URLSearchParams("compare=draft"))).toBe("draft");
	});

	it("WRITE-C3 asks for the editor when the mode is missing or not one it knows", () => {
		expect(compareModeOf(new URLSearchParams(""))).toBeNull();
		expect(compareModeOf(new URLSearchParams("compare=other"))).toBeNull();
	});
});
