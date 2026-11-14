import { describe, expect, it } from "vitest";
import { countedWhere } from "./counted-where";

describe("what a filter menu's counts count (LT-12, MD-07)", () => {
	it("with no folders nothing is said, even where folders are on", () => {
		expect(countedWhere({ folders: 0, open: null, everywhere: false })).toBeNull();
	});

	it("at the top a pick looks through every folder", () => {
		expect(countedWhere({ folders: 2, open: null, everywhere: false })).toBe("list.countedEverywhere");
	});

	it("inside a folder it looks through that folder and those below it", () => {
		expect(countedWhere({ folders: 2, open: "f_1", everywhere: false })).toBe("list.countedBelow");
	});

	it("a search through every folder counts in every folder, inside a folder too", () => {
		expect(countedWhere({ folders: 2, open: "f_1", everywhere: true })).toBe("list.countedEverywhere");
	});
});
