import { describe, expect, it } from "vitest";
import { columnMenuOf, isColumnFiltered } from "../list-column-menu";
import { parseListState } from "../list-state";
import { listSite } from "./list-site";

const site = listSite();

const stateOf = (query: string) => parseListState(site, new URLSearchParams(query));
const menu = (column: string, collection = "story") => columnMenuOf(site, collection, column);

describe("the sections of a column's menu", () => {
	it("LIST-F2 filters the status, the language with the translation state, the dates, and the stored fields by their kind", () => {
		expect(menu("status").filter).toEqual({ kind: "status" });
		expect(menu("locale").filter).toEqual({ kind: "language", translation: true });
		expect(menu("updatedAt").filter).toEqual({ kind: "date", key: "updated" });
		expect(menu("publishedAt").filter).toEqual({ kind: "date", key: "published" });
		expect(menu("createdAt").filter).toEqual({ kind: "date", key: "created" });
		expect(menu("labelIds").filter).toMatchObject({ kind: "field", field: { name: "labelIds", kind: "relation" } });
		expect(menu("state").filter).toMatchObject({ kind: "field", field: { name: "state", kind: "select" } });
		expect(menu("lede").filter).toMatchObject({ kind: "field", field: { name: "lede", kind: "text" } });
		expect(menu("cover").filter).toMatchObject({ kind: "field", field: { name: "cover", kind: "media" } });
	});

	it("LIST-F2 has no values to filter by on the title, the address and the folder: they are found by search or in the sidebar", () => {
		for (const column of ["title", "slug", "folder"]) expect(menu(column).filter, column).toBeNull();
	});

	it("LIST-F2 leaves the translation state out of an item collection's language menu", () => {
		expect(menu("locale", "label").filter).toEqual({ kind: "language", translation: false });
	});
});

describe("the dot after a filtered column's name", () => {
	const filtered = (query: string, column: string) => isColumnFiltered(site, "story", column, stateOf(query));

	it("LIST-F2 is on the column whose filter is on, and on no other", () => {
		expect(filtered("collection=story&status=draft", "status")).toBe(true);
		expect(filtered("collection=story&status=draft", "labelIds")).toBe(false);
		expect(filtered("collection=story&field=labelIds:empty", "labelIds")).toBe(true);
		expect(filtered("collection=story&field=lede:empty", "lede")).toBe(true);
		expect(filtered("collection=story&updated=today", "updatedAt")).toBe(true);
		expect(filtered("collection=story&created=today", "createdAt")).toBe(true);
		expect(filtered("collection=story&updated=today", "createdAt")).toBe(false);
	});

	it("LIST-F2 is on the language column for the language and for the translation state", () => {
		expect(filtered(`collection=story&locale=${site.LOCALES[0]}`, "locale")).toBe(true);
		expect(filtered("collection=story&translation=changed", "locale")).toBe(true);
	});
});
