import { describe, expect, it } from "vitest";
import { pageWindow } from "../page-window";

describe("the page buttons", () => {
	it("are the one page of a list that fits on one", () => {
		expect(pageWindow(1, 1)).toEqual([1]);
	});

	it("show the first three pages and the last at the start of a run", () => {
		expect(pageWindow(1, 6)).toEqual([1, 2, 3, "gap", 6]);
	});

	it("show the first and the last, and the current page with its neighbours in between", () => {
		expect(pageWindow(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
	});

	it("show a page rather than a gap that would hide only that page", () => {
		expect(pageWindow(3, 6)).toEqual([1, 2, 3, 4, 5, 6]);
		expect(pageWindow(4, 8)).toEqual([1, 2, 3, 4, 5, "gap", 8]);
	});

	it("show the last three pages at the end of a run", () => {
		expect(pageWindow(20, 20)).toEqual([1, "gap", 18, 19, 20]);
	});
});
