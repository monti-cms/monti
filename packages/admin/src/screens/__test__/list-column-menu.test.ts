import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { columnMenuOf, hiddenColumns, isColumnFiltered } from "../list-column-menu";
import { columnsFor } from "../list-columns";
import { parseListState } from "../list-state";

const stateOf = (query: string) => parseListState(testSite, new URLSearchParams(query));
const menu = (column: string, collection = "post") => columnMenuOf(testSite, collection, column);

describe("the sections of a column's menu", () => {

	it("LIST-F2 filters the status, the language with the translation state, the dates, and the stored fields by their kind", () => {
		expect(menu("status").filter).toEqual({ kind: "status" });
		expect(menu("locale").filter).toEqual({ kind: "language", translation: true });
		expect(menu("updatedAt").filter).toEqual({ kind: "date", key: "updated" });
		expect(menu("publishedAt").filter).toEqual({ kind: "date", key: "published" });
		expect(menu("createdAt").filter).toEqual({ kind: "date", key: "created" });
		expect(menu("tagIds").filter).toMatchObject({ kind: "field", field: { name: "tagIds", kind: "relation" } });
		expect(menu("policy").filter).toMatchObject({ kind: "field", field: { name: "policy", kind: "select" } });
		expect(menu("summary").filter).toMatchObject({ kind: "field", field: { name: "summary", kind: "text" } });
	});

	it("LIST-F2 has no values to filter by on the title, the address and the folder: they are found by search or in the sidebar", () => {
		for (const column of ["title", "slug", "folder"]) expect(menu(column).filter, column).toBeNull();
	});

	it("LIST-F2 leaves the translation state out of an item collection's language menu", () => {
		expect(menu("locale", "tag").filter).toEqual({ kind: "language", translation: false });
	});

});

describe("the dot after a filtered column's name", () => {
	const filtered = (query: string, column: string) => isColumnFiltered(testSite, "post", column, stateOf(query));

	it("LIST-F2 is on the column whose filter is on, and on no other", () => {
		expect(filtered("collection=post&status=draft", "status")).toBe(true);
		expect(filtered("collection=post&status=draft", "tagIds")).toBe(false);
		expect(filtered("collection=post&field=tagIds:empty", "tagIds")).toBe(true);
		expect(filtered("collection=post&field=summary:empty", "summary")).toBe(true);
		expect(filtered("collection=post&updated=today", "updatedAt")).toBe(true);
		expect(filtered("collection=post&created=today", "createdAt")).toBe(true);
		expect(filtered("collection=post&updated=today", "createdAt")).toBe(false);
	});

	it("LIST-F2 is on the language column for the language and for the translation state", () => {
		expect(filtered(`collection=post&locale=${testSite.LOCALES[0]}`, "locale")).toBe(true);
		expect(filtered("collection=post&translation=changed", "locale")).toBe(true);
	});
});

