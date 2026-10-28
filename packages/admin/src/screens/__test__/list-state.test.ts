import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { siteWithFolders } from "../../test/site";
import {
	activeFilterCount,
	clearFiltersPatch,
	isExplorerMode,
	isFiltered,
	listStateToApiQuery,
	listStateToCountsQuery,
	listStateToSearchParams,
	parseListState,
} from "../list-state";

const NOW = new Date("2026-10-28T03:00:00Z"); // 12:00 on 28 October in Seoul

describe("admin list state", () => {
	it("round-trips filters through the URL", () => {
		const url = new URLSearchParams(
			"collection=post&folder=f1&descendants=1&search=리액트&status=published&status=draft&changes=1&field=tagIds:empty&field=tagIds:is:t1&field=summary:filled&translation=changed&translation=none&updated=last30&published=2026-03-01..2026-03-05&sortField=publishedAt&sortDirection=asc&page=2&pageSize=50",
		);
		const state = parseListState(testSite, url);
		expect(state).toMatchObject({
			collection: "post",
			folder: "f1",
			includeDescendants: true,
			search: "리액트",
			statuses: ["published", "draft"],
			hasChanges: true,
			fields: {
				tagIds: [{ kind: "empty" }, { kind: "is", value: "t1" }],
				summary: [{ kind: "filled" }],
			},
			translations: ["changed", "none"],
			updated: { kind: "preset", preset: "last30" },
			published: { kind: "range", from: "2026-03-01", to: "2026-03-05" },
			sortField: "publishedAt",
			sortDirection: "asc",
			page: 2,
			pageSize: 50,
			explicit: { pageSize: true, sort: true },
		});
		expect(parseListState(testSite, listStateToSearchParams(state))).toMatchObject({
			...state,
			explicit: { pageSize: true, sort: true },
		});
	});

	it("drops the locale and translation filters when translations are off, since their controls are hidden", () => {
		const url = new URLSearchParams(`locale=${testSite.LOCALES[0]}&translation=none`);
		const withTranslations = Object.create(testSite, { ADMIN_TRANSLATIONS: { value: true } });
		const without = Object.create(testSite, { ADMIN_TRANSLATIONS: { value: false } });
		expect(parseListState(withTranslations, url)).toMatchObject({
			locales: [testSite.LOCALES[0]],
			translations: ["none"],
		});
		expect(parseListState(without, url)).toMatchObject({ locales: [], translations: [] });
	});

	it("ignores invalid values instead of sending them to the API", () => {
		const state = parseListState(
			testSite,
			new URLSearchParams(
				"collection=nope&status=deleted&status=trashed&pageSize=30&translation=stale&updated=어제&published=2026-03-05..2026-03-01",
			),
		);
		expect(state).toMatchObject({
			collection: "post",
			statuses: [],
			pageSize: 25,
			translations: [],
			updated: null,
			published: null,
		});
	});

	it("keeps only conditions a field of the collection takes", () => {
		// A memo has no category field and a title is not a filterable field. A relation has no "filled", a text has no "is", malformed values go too.
		const state = parseListState(
			testSite,
			new URLSearchParams(
				"collection=memo&field=tagIds:is:t1&field=categoryId:is:c1&field=title:empty&field=tagIds:filled&field=seoTitle:is:x&field=tagIds:is:&field=t9",
			),
		);
		expect(state.fields).toEqual({ tagIds: [{ kind: "is", value: "t1" }] });
	});

	it("has no published date on an item collection", () => {
		const state = parseListState(testSite, new URLSearchParams("collection=tag&updated=today&published=today"));
		expect(state).toMatchObject({ updated: { kind: "preset", preset: "today" }, published: null });
	});

	it("builds the API query with repeated conditions and Seoul day boundaries", () => {
		const state = parseListState(
			testSite,
			new URLSearchParams(
				"collection=post&field=tagIds:empty&field=tagIds:is:t1&field=categoryId:is:c1&translation=changed&published=2026-03-01..2026-03-01",
			),
		);
		const query = listStateToApiQuery(testSite, state, { now: NOW });
		// With a filter, it searches across all folders even at the top level.
		expect(query.get("folderId")).toBeNull();
		expect(query.getAll("field")).toEqual(["tagIds:empty", "tagIds:is:t1", "categoryId:is:c1"]);
		expect(query.getAll("translation")).toEqual(["changed"]);
		expect(query.get("publishedFrom")).toBe("2026-02-28T15:00:00.000Z");
		expect(query.get("publishedTo")).toBe("2026-03-01T14:59:59.999Z");
	});

	it("resolves a preset against today in the site's time zone each time the query is built", () => {
		const state = parseListState(testSite, new URLSearchParams("collection=post&updated=last7"));
		const monday = listStateToApiQuery(testSite, state, { now: NOW });
		expect(monday.get("updatedFrom")).toBe("2026-10-21T15:00:00.000Z");
		expect(monday.get("updatedTo")).toBe("2026-10-28T14:59:59.999Z");
		const later = listStateToApiQuery(testSite, state, { now: new Date("2026-11-04T03:00:00Z") });
		expect(later.get("updatedFrom")).toBe("2026-10-28T15:00:00.000Z");
	});

	it("does not send the column filters of the old toolbar", () => {
		const state = parseListState(
			testSite,
			new URLSearchParams("collection=post&title=훅&slug=react&relation=tagIds:t1"),
		);
		const query = listStateToApiQuery(testSite, state);
		for (const key of ["titleContains", "slugContains", "relation"]) expect(query.has(key)).toBe(false);
	});

	it("shows folders only when no search or filter narrows the list", () => {
		expect(isExplorerMode(parseListState(testSite, new URLSearchParams("collection=post")))).toBe(true);
		expect(isExplorerMode(parseListState(testSite, new URLSearchParams("collection=post&search=a")))).toBe(false);
		expect(isExplorerMode(parseListState(testSite, new URLSearchParams("collection=post&descendants=1")))).toBe(false);
	});

	it("browses the root like a file explorer and flattens only when asked", () => {
		const q = (search: string) => listStateToApiQuery(testSite, parseListState(testSite, new URLSearchParams(search)));
		// Top-level browse: only items outside folders.
		expect(q("collection=memo").get("folderId")).toBe("null");
		// Top level with subfolders included: everything.
		expect(q("collection=memo&descendants=1").get("folderId")).toBeNull();
		// Folder browse: only directly contained items.
		expect(q("collection=memo&folder=f1").get("folderId")).toBe("f1");
		expect(q("collection=memo&folder=f1").get("includeDescendants")).toBeNull();
		// Search inside a folder: everything under that folder.
		expect(q("collection=memo&folder=f1&search=a").get("includeDescendants")).toBe("true");
	});

	it("asks for trashed items only on the trash screen", () => {
		const state = parseListState(
			testSite,
			new URLSearchParams("collection=post&folder=f1&status=draft&status=archived"),
		);
		const list = listStateToApiQuery(testSite, state);
		expect(list.getAll("status")).toEqual(["draft", "archived"]);
		expect(list.get("folderId")).toBe("f1");

		const trash = listStateToApiQuery(testSite, state, { trash: true });
		expect(trash.getAll("status")).toEqual(["trashed"]);
		expect(trash.has("folderId")).toBe(false);
	});

	it("tells what narrows the list and clears only that", () => {
		const narrowed = parseListState(
			testSite,
			new URLSearchParams("collection=post&folder=f1&field=tagIds:empty&updated=today&pageSize=50"),
		);
		expect(isFiltered(narrowed)).toBe(true);
		expect(activeFilterCount(narrowed)).toBe(2);
		const cleared = { ...narrowed, ...clearFiltersPatch(narrowed) };
		expect(isFiltered(cleared)).toBe(false);
		expect(cleared).toMatchObject({ folder: "f1", pageSize: 50 });
	});
});

describe("list state for a collection without folders", () => {
	const folderId = "6f1c1d6e-0a3b-4c53-9a43-0d6f4a9d2b11";
	const off = siteWithFolders("post", false);
	const on = siteWithFolders("post", true);
	const params = `collection=post&folder=${folderId}`;

	it("ignores ?folder= in the address, but keeps it where the collection has folders", () => {
		expect(parseListState(off, new URLSearchParams(params)).folder).toBe("all");
		expect(parseListState(on, new URLSearchParams(params)).folder).toBe(folderId);
	});

	it("asks for no folder filter, so entries filed before folders were turned off stay listed", () => {
		const query = (site: typeof on) =>
			listStateToApiQuery(site, parseListState(site, new URLSearchParams("collection=post")));
		expect(query(off).has("folderId")).toBe(false);
		// With folders, browse mode lists only what sits directly at the top level.
		expect(query(on).get("folderId")).toBe("null");
	});

	it("sends no folder even when a state still carries one", () => {
		const state = { ...parseListState(on, new URLSearchParams(params)) };
		expect(listStateToApiQuery(on, state).get("folderId")).toBe(folderId);
		expect(listStateToApiQuery(off, state).has("folderId")).toBe(false);
	});
});

describe("the query for the numbers beside the filter menu", () => {
	const q = (search: string, facet: Parameters<typeof listStateToCountsQuery>[2]) =>
		listStateToCountsQuery(testSite, parseListState(testSite, new URLSearchParams(search)), facet);

	it("asks for one field, or for the translation filter, grouped by translation like the list", () => {
		expect(q("collection=post", { field: "tagIds" }).toString()).toBe("collection=post&field=tagIds&group=translation");
		expect(q("collection=post", "translation").get("facet")).toBe("translation");
		expect(q("collection=tag", { field: "title" }).has("group")).toBe(false);
	});

	it("counts the current folder with its subfolders, and the status of the tab", () => {
		const query = q("collection=post&folder=f1&status=published", { field: "tagIds" });
		expect(query.get("folderId")).toBe("f1");
		expect(query.get("includeDescendants")).toBe("true");
		expect(query.getAll("status")).toEqual(["published"]);
	});

	it("counts everything at the top level, and ignores the other filters", () => {
		const query = q("collection=post&field=tagIds:empty&updated=today&search=a", { field: "tagIds" });
		expect(query.has("folderId")).toBe(false);
		for (const key of ["updatedFrom", "search", "field:tagIds"]) expect(query.has(key)).toBe(false);
		expect(query.getAll("field")).toEqual(["tagIds"]);
	});
});
