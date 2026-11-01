import { describe, expect, it } from "vitest";
import {
	activeFilterCount,
	clearFiltersPatch,
	isExplorerMode,
	isFiltered,
	listStateToApiQuery,
	listStateToCountsQuery,
	listStateToSearchParams,
	parseListState,
	searchScopeChoice,
} from "../list-state";
import { listSite } from "./list-site";

const site = listSite();

const NOW = new Date("2026-10-28T03:00:00Z"); // 12:00 on 28 October in Seoul

describe("admin list state", () => {
	it("LIST-F5 round-trips filters through the URL", () => {
		const url = new URLSearchParams(
			"collection=story&folder=f1&descendants=1&search=리액트&status=published&status=editing&status=draft&field=labelIds:empty&field=labelIds:is:t1&field=lede:empty&translation=changed&translation=none&updated=last30&published=2026-03-01..2026-03-05&created=last7&sortField=publishedAt&sortDirection=asc&page=2&pageSize=50",
		);
		const state = parseListState(site, url);
		expect(state).toMatchObject({
			collection: "story",
			folder: "f1",
			includeDescendants: true,
			search: "리액트",
			statuses: ["published", "editing", "draft"],
			fields: {
				labelIds: [{ kind: "empty" }, { kind: "is", value: "t1" }],
				lede: [{ kind: "empty" }],
			},
			translations: ["changed", "none"],
			updated: { kind: "preset", preset: "last30" },
			published: { kind: "range", from: "2026-03-01", to: "2026-03-05" },
			created: { kind: "preset", preset: "last7" },
			sortField: "publishedAt",
			sortDirection: "asc",
			page: 2,
			pageSize: 50,
			explicit: { pageSize: true, sort: true },
		});
		expect(parseListState(site, listStateToSearchParams(state))).toMatchObject({
			...state,
			explicit: { pageSize: true, sort: true },
		});
	});

	it("LIST-F5 drops the locale and translation filters when translations are off, since their controls are hidden", () => {
		const url = new URLSearchParams(`locale=${site.LOCALES[0]}&translation=none`);
		const withTranslations = Object.create(site, { ADMIN_TRANSLATIONS: { value: true } });
		const without = Object.create(site, { ADMIN_TRANSLATIONS: { value: false } });
		expect(parseListState(withTranslations, url)).toMatchObject({
			locales: [site.LOCALES[0]],
			translations: ["none"],
		});
		expect(parseListState(without, url)).toMatchObject({ locales: [], translations: [] });
	});

	it("LIST-F5 ignores invalid values instead of sending them to the API", () => {
		const state = parseListState(
			site,
			new URLSearchParams(
				"collection=nope&status=deleted&status=trashed&pageSize=30&translation=stale&updated=어제&published=2026-03-05..2026-03-01",
			),
		);
		expect(state).toMatchObject({
			collection: "story",
			statuses: [],
			pageSize: 25,
			translations: [],
			updated: null,
			published: null,
		});
	});

	it("LIST-F5 keeps only conditions a field of the collection takes", () => {
		// A note has no desk field and a title is not a filterable field. A relation has no "filled", a text has no "is", malformed values go too.
		const state = parseListState(
			site,
			new URLSearchParams(
				"collection=note&field=labelIds:is:t1&field=deskId:is:c1&field=title:empty&field=labelIds:filled&field=blurb:is:x&field=labelIds:is:&field=t9",
			),
		);
		expect(state.fields).toEqual({ labelIds: [{ kind: "is", value: "t1" }] });
	});

	it("LIST-F2 keeps the four states of the status column as one list, and no longer reads a separate unpublished-changes flag", () => {
		const state = parseListState(
			site,
			new URLSearchParams("collection=story&status=editing&status=draft&status=editing&changes=1"),
		);
		expect(state.statuses).toEqual(["editing", "draft"]);
		expect("hasChanges" in state).toBe(false);
		const query = listStateToApiQuery(site, state);
		expect(query.getAll("status")).toEqual(["editing", "draft"]);
		expect(query.has("hasChanges")).toBe(false);
		expect(listStateToSearchParams(state).has("changes")).toBe(false);
	});

	it("LIST-F4 sends the created date as a range like the updated and published dates, for an item collection too", () => {
		const state = parseListState(site, new URLSearchParams("collection=desk&created=2026-03-01..2026-03-05"));
		const query = listStateToApiQuery(site, state, { now: NOW });
		expect(query.get("createdFrom")).toBe("2026-02-28T15:00:00.000Z");
		expect(query.get("createdTo")).toBe("2026-03-05T14:59:59.999Z");
		expect(listStateToSearchParams(state).get("created")).toBe("2026-03-01..2026-03-05");
	});

	it("LIST-F4 has no published date on an item collection", () => {
		const state = parseListState(site, new URLSearchParams("collection=desk&updated=today&published=today"));
		expect(state).toMatchObject({ updated: { kind: "preset", preset: "today" }, published: null });
	});

	it("LIST-F4 builds the API query with repeated conditions and Seoul day boundaries", () => {
		const state = parseListState(
			site,
			new URLSearchParams(
				"collection=story&field=labelIds:empty&field=labelIds:is:t1&field=deskId:is:c1&translation=changed&published=2026-03-01..2026-03-01",
			),
		);
		const query = listStateToApiQuery(site, state, { now: NOW });
		// With a filter, it searches across all folders even at the top level.
		expect(query.get("folderId")).toBeNull();
		expect(query.getAll("field")).toEqual(["labelIds:empty", "labelIds:is:t1", "deskId:is:c1"]);
		expect(query.getAll("translation")).toEqual(["changed"]);
		expect(query.get("publishedFrom")).toBe("2026-02-28T15:00:00.000Z");
		expect(query.get("publishedTo")).toBe("2026-03-01T14:59:59.999Z");
	});

	it("LIST-F4 resolves a preset against today in the site's time zone each time the query is built", () => {
		const state = parseListState(site, new URLSearchParams("collection=story&updated=last7"));
		const monday = listStateToApiQuery(site, state, { now: NOW });
		expect(monday.get("updatedFrom")).toBe("2026-10-21T15:00:00.000Z");
		expect(monday.get("updatedTo")).toBe("2026-10-28T14:59:59.999Z");
		const later = listStateToApiQuery(site, state, { now: new Date("2026-11-04T03:00:00Z") });
		expect(later.get("updatedFrom")).toBe("2026-10-28T15:00:00.000Z");
	});

	it("LIST-F6 shows folders only when no search or filter narrows the list", () => {
		expect(isExplorerMode(parseListState(site, new URLSearchParams("collection=story")))).toBe(true);
		expect(isExplorerMode(parseListState(site, new URLSearchParams("collection=story&search=a")))).toBe(false);
		expect(isExplorerMode(parseListState(site, new URLSearchParams("collection=story&descendants=1")))).toBe(false);
	});

	it("LIST-F6 browses the root like a file explorer and flattens only when asked", () => {
		const q = (search: string) => listStateToApiQuery(site, parseListState(site, new URLSearchParams(search)));
		// Top-level browse: only items outside folders.
		expect(q("collection=note").get("folderId")).toBe("null");
		// Top level with subfolders included: everything.
		expect(q("collection=note&descendants=1").get("folderId")).toBeNull();
		// Folder browse: only directly contained items.
		expect(q("collection=note&folder=f1").get("folderId")).toBe("f1");
		expect(q("collection=note&folder=f1").get("includeDescendants")).toBeNull();
		// Search inside a folder: everything under that folder.
		expect(q("collection=note&folder=f1&search=a").get("includeDescendants")).toBe("true");
	});

	it("LIST-F3 asks for the statuses the list is filtered by, in the folder it is in", () => {
		const state = parseListState(site, new URLSearchParams("collection=story&folder=f1&status=draft&status=archived"));
		const list = listStateToApiQuery(site, state);
		expect(list.getAll("status")).toEqual(["draft", "archived"]);
		expect(list.get("folderId")).toBe("f1");
	});

	it("LIST-F5 tells what narrows the list, the status among it, and clears only that", () => {
		const narrowed = parseListState(
			site,
			new URLSearchParams("collection=story&folder=f1&status=draft&field=labelIds:empty&updated=today&pageSize=50"),
		);
		expect(isFiltered(narrowed)).toBe(true);
		expect(activeFilterCount(narrowed)).toBe(3);
		// A status narrows the list, so the folders are not browsed.
		expect(isExplorerMode(parseListState(site, new URLSearchParams("collection=story&status=draft")))).toBe(false);
		const cleared = { ...narrowed, ...clearFiltersPatch(narrowed) };
		expect(isFiltered(cleared)).toBe(false);
		expect(cleared).toMatchObject({ folder: "f1", pageSize: 50 });
	});
});

describe("list state for a collection without folders", () => {
	const folderId = "6f1c1d6e-0a3b-4c53-9a43-0d6f4a9d2b11";
	const off = listSite({ storyFolders: false });
	const on = listSite({ storyFolders: true });
	const params = `collection=story&folder=${folderId}`;

	it("LIST-F6 ignores ?folder= in the address, but keeps it where the collection has folders", () => {
		expect(parseListState(off, new URLSearchParams(params)).folder).toBe("all");
		expect(parseListState(on, new URLSearchParams(params)).folder).toBe(folderId);
	});

	it("LIST-F6 asks for no folder filter, so entries filed before folders were turned off stay listed", () => {
		const query = (site: typeof on) =>
			listStateToApiQuery(site, parseListState(site, new URLSearchParams("collection=story")));
		expect(query(off).has("folderId")).toBe(false);
		// With folders, browse mode lists only what sits directly at the top level.
		expect(query(on).get("folderId")).toBe("null");
	});

	it("LIST-F6 sends no folder even when a state still carries one", () => {
		const state = { ...parseListState(on, new URLSearchParams(params)) };
		expect(listStateToApiQuery(on, state).get("folderId")).toBe(folderId);
		expect(listStateToApiQuery(off, state).has("folderId")).toBe(false);
	});
});

describe("the query for the numbers beside a column menu's values", () => {
	const q = (search: string, facet: Parameters<typeof listStateToCountsQuery>[2]) =>
		listStateToCountsQuery(site, parseListState(site, new URLSearchParams(search)), facet);

	it("LIST-F3 asks for one field, for the translation filter or for the status, grouped by translation like the list", () => {
		expect(q("collection=story", { field: "labelIds" }).toString()).toBe(
			"collection=story&field=labelIds&group=translation",
		);
		expect(q("collection=story", "translation").get("facet")).toBe("translation");
		expect(q("collection=story", "status").get("facet")).toBe("status");
		expect(q("collection=desk", { field: "title" }).has("group")).toBe(false);
	});

	it("LIST-F3 counts the current folder with its subfolders, and not the status that is picked", () => {
		const query = q("collection=story&folder=f1&status=published", { field: "labelIds" });
		expect(query.get("folderId")).toBe("f1");
		expect(query.get("includeDescendants")).toBe("true");
		expect(query.has("status")).toBe(false);
	});

	it("LIST-F3 counts everything at the top level, and ignores the other filters", () => {
		const query = q("collection=story&field=labelIds:empty&updated=today&search=a", { field: "labelIds" });
		expect(query.has("folderId")).toBe(false);
		for (const key of ["updatedFrom", "search", "field:labelIds"]) expect(query.has(key)).toBe(false);
		expect(query.getAll("field")).toEqual(["labelIds"]);
	});
});

describe("where a search inside a folder looks", () => {
	const state = (query: string) => parseListState(site, new URLSearchParams(query));
	const api = (query: string) => listStateToApiQuery(site, state(query));

	it("LIST-F6 looks in the folder and the folders below it, unless widened to all folders", () => {
		const here = api("collection=story&folder=f1&search=a");
		expect([here.get("folderId"), here.get("includeDescendants")]).toEqual(["f1", "true"]);
		const everywhere = api("collection=story&folder=f1&search=a&scope=all");
		expect(everywhere.has("folderId")).toBe(false);
		expect(everywhere.has("includeDescendants")).toBe(false);
		expect(everywhere.get("search")).toBe("a");
	});

	it("LIST-F6 offers the choice only for words typed in a folder", () => {
		expect(searchScopeChoice(state("collection=story&folder=f1&search=a"))).toBe(true);
		expect(searchScopeChoice(state("collection=story&folder=f1"))).toBe(false);
		expect(searchScopeChoice(state("collection=story&folder=f1&search=%20"))).toBe(false);
		expect(searchScopeChoice(state("collection=story&search=a"))).toBe(false);
	});
});
