import { describe, expect, it } from "vitest";
import { pageWindow } from "../page-window";

describe("the page buttons", () => {
	it("are every page of a list of up to seven pages", () => {
		expect(pageWindow(1, 1)).toEqual([1]);
		expect(pageWindow(4, 6)).toEqual([1, 2, 3, 4, 5, 6]);
		expect(pageWindow(7, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
	});

	it("keep the same number of buttons on every page of a longer list", () => {
		for (let page = 1; page <= 20; page++) expect(pageWindow(page, 20)).toHaveLength(7);
	});

	it("show the first five pages and the last near the start", () => {
		expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, 5, "gap", 20]);
		expect(pageWindow(4, 20)).toEqual([1, 2, 3, 4, 5, "gap", 20]);
	});

	it("show the first and the last, and the current page with its neighbours in between", () => {
		expect(pageWindow(10, 20)).toEqual([1, "gap", 9, 10, 11, "gap", 20]);
	});

	it("show the first page and the last five near the end", () => {
		expect(pageWindow(17, 20)).toEqual([1, "gap", 16, 17, 18, 19, 20]);
		expect(pageWindow(20, 20)).toEqual([1, "gap", 16, 17, 18, 19, 20]);
	});
});
