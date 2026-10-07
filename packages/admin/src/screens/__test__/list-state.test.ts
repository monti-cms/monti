import { describe, expect, it } from "vitest";
import { testSite } from "../../../../core/test/site";
import { isExplorerMode, listStateToApiQuery, listStateToSearchParams, parseListState } from "../list-state";

describe("admin list state", () => {
	it("round-trips filters through the URL", () => {
		const url = new URLSearchParams(
			"collection=memo&folder=f1&descendants=1&search=리액트&title=훅&status=published&status=draft&changes=1&relation=tagIds:t1&relation=tagIds:t2&updatedFrom=2026-01-01&sortField=publishedAt&sortDirection=asc&page=2&pageSize=50",
		);
		const state = parseListState(testSite, url);
		expect(state).toMatchObject({
			collection: "memo",
			folder: "f1",
			includeDescendants: true,
			search: "리액트",
			titleContains: "훅",
			statuses: ["published", "draft"],
			hasChanges: true,
			relations: { tagIds: ["t1", "t2"] },
			updatedFrom: "2026-01-01",
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

	it("ignores invalid values instead of sending them to the API", () => {
		const state = parseListState(
			testSite,
			new URLSearchParams("collection=nope&status=deleted&status=trashed&pageSize=30&createdFrom=어제"),
		);
		expect(state).toMatchObject({ collection: "post", statuses: [], pageSize: 25, createdFrom: "" });
	});

	it("keeps only taxonomy fields of the collection in relation filters", () => {
		// A memo has no category field, and `title` is not a taxonomy field. Malformed values are dropped too.
		const state = parseListState(
			testSite,
			new URLSearchParams(
				"collection=memo&relation=tagIds:t1&relation=categoryId:c1&relation=title:x&relation=tagIds:&relation=t9",
			),
		);
		expect(state.relations).toEqual({ tagIds: ["t1"] });
	});

	it("builds the API query with OR-able repeats and Seoul day boundaries", () => {
		const state = parseListState(
			testSite,
			new URLSearchParams(
				"collection=post&relation=tagIds:t1&relation=tagIds:t2&relation=categoryId:c1&publishedFrom=2026-03-01&publishedTo=2026-03-01",
			),
		);
		const query = listStateToApiQuery(testSite, state);
		// With a filter, it searches across all folders even at the top level.
		expect(query.get("folderId")).toBeNull();
		expect(query.getAll("relation")).toEqual(["tagIds:t1", "tagIds:t2", "categoryId:c1"]);
		expect(query.get("publishedFrom")).toBe("2026-02-28T15:00:00.000Z");
		expect(query.get("publishedTo")).toBe("2026-03-01T14:59:59.999Z");
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
		// An old address's unfiled is read as the top level.
		expect(parseListState(testSite, new URLSearchParams("collection=memo&folder=unfiled")).folder).toBe("all");
	});

	it("sends header filters and asks for trashed items only on the trash screen", () => {
		const state = parseListState(
			testSite,
			new URLSearchParams("collection=post&folder=f1&title=%20훅%20&slug=react&status=draft&status=archived"),
		);
		const list = listStateToApiQuery(testSite, state);
		expect(list.get("titleContains")).toBe("훅");
		expect(list.get("slugContains")).toBe("react");
		expect(list.getAll("status")).toEqual(["draft", "archived"]);
		expect(list.get("folderId")).toBe("f1");

		const trash = listStateToApiQuery(testSite, state, { trash: true });
		expect(trash.getAll("status")).toEqual(["trashed"]);
		expect(trash.has("folderId")).toBe(false);
	});
});
