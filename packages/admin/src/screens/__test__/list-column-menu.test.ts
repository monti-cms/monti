import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { columnMenuOf, hiddenColumns, isColumnFiltered } from "../list-column-menu";
import { columnsFor } from "../list-columns";
import { parseListState } from "../list-state";

const stateOf = (query: string) => parseListState(testSite, new URLSearchParams(query));
const menu = (column: string, collection = "post") => columnMenuOf(testSite, collection, column);

describe("the sections of a column's menu", () => {
	it("sorts only the title, the address and the three dates, texts as letters and dates as dates", () => {
		expect(menu("title").sort).toEqual({ field: "title", reads: "text" });
		expect(menu("slug").sort).toEqual({ field: "slug", reads: "text" });
		expect(menu("updatedAt").sort).toEqual({ field: "updatedAt", reads: "date" });
		expect(menu("publishedAt").sort).toEqual({ field: "publishedAt", reads: "date" });
		expect(menu("createdAt").sort).toEqual({ field: "createdAt", reads: "date" });
		for (const column of ["status", "locale", "folder", "categoryId", "tagIds", "summary"]) {
			expect(menu(column).sort, column).toBeNull();
		}
	});

	it("filters the status, the language with the translation state, the dates, and the stored fields by their kind", () => {
		expect(menu("status").filter).toEqual({ kind: "status" });
		expect(menu("locale").filter).toEqual({ kind: "language", translation: true });
		expect(menu("updatedAt").filter).toEqual({ kind: "date", key: "updated" });
		expect(menu("publishedAt").filter).toEqual({ kind: "date", key: "published" });
		expect(menu("createdAt").filter).toEqual({ kind: "date", key: "created" });
		expect(menu("tagIds").filter).toMatchObject({ kind: "field", field: { name: "tagIds", kind: "relation" } });
		expect(menu("policy").filter).toMatchObject({ kind: "field", field: { name: "policy", kind: "select" } });
		expect(menu("summary").filter).toMatchObject({ kind: "field", field: { name: "summary", kind: "text" } });
	});

	it("has no values to filter by on the title, the address and the folder: they are found by search or in the sidebar", () => {
		for (const column of ["title", "slug", "folder"]) expect(menu(column).filter, column).toBeNull();
	});

	it("leaves the translation state out of an item collection's language menu", () => {
		expect(menu("locale", "tag").filter).toEqual({ kind: "language", translation: false });
	});

	it("hides every column but the title", () => {
		expect(menu("title").hide).toBe(false);
		for (const column of columnsFor(testSite, "post").available.filter((candidate) => candidate !== "title")) {
			expect(menu(column).hide, column).toBe(true);
		}
	});

	it("gives every column of the list something to press: a section of its own, or hide", () => {
		for (const column of columnsFor(testSite, "post").available) {
			const { sort, filter, hide } = menu(column);
			expect(Boolean(sort) || Boolean(filter) || hide, column).toBe(true);
		}
	});
});

describe("the dot after a filtered column's name", () => {
	const filtered = (query: string, column: string) => isColumnFiltered(testSite, "post", column, stateOf(query));

	it("is on the column whose filter is on, and on no other", () => {
		expect(filtered("collection=post&status=draft", "status")).toBe(true);
		expect(filtered("collection=post&status=draft", "tagIds")).toBe(false);
		expect(filtered("collection=post&field=tagIds:empty", "tagIds")).toBe(true);
		expect(filtered("collection=post&field=summary:empty", "summary")).toBe(true);
		expect(filtered("collection=post&updated=today", "updatedAt")).toBe(true);
		expect(filtered("collection=post&created=today", "createdAt")).toBe(true);
		expect(filtered("collection=post&updated=today", "createdAt")).toBe(false);
	});

	it("is on the language column for the language and for the translation state", () => {
		expect(filtered(`collection=post&locale=${testSite.LOCALES[0]}`, "locale")).toBe(true);
		expect(filtered("collection=post&translation=changed", "locale")).toBe(true);
	});

	it("is on no column when nothing is filtered, whatever the search says", () => {
		for (const column of columnsFor(testSite, "post").available) {
			expect(filtered("collection=post&search=a", column), column).toBe(false);
		}
	});
});

describe("the columns of the + at the end of the head row", () => {
	it("are the hidden ones in the saved order, and never the title", () => {
		const order = ["status", "title", "slug", "tagIds", "updatedAt"];
		const visibility = { status: true, title: true, slug: false, tagIds: true, updatedAt: false };
		expect(hiddenColumns(order, visibility)).toEqual(["slug", "updatedAt"]);
		expect(hiddenColumns(order, { ...visibility, title: false })).not.toContain("title");
	});

	it("are none when every column is on", () => {
		expect(hiddenColumns(["title", "status"], { title: true, status: true })).toEqual([]);
	});
});
