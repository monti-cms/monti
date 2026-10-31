import type { Folder } from "@monti-cms/core/site";
import { describe, expect, it } from "vitest";
import {
	folderChoices,
	folderPathBelow,
	folderTrail,
	hasScope,
	isFiltered,
	isSearching,
	type MediaState,
	mediaCountsParams,
	mediaListParams,
	selectAllState,
	toggleKind,
	withKind,
} from "../media-state";

const state = (patch: Partial<MediaState> = {}): MediaState => ({
	page: 1,
	pageSize: 25,
	search: "",
	used: "all",
	kind: "all",
	alt: "all",
	sort: "uploaded",
	scope: "here",
	folder: "",
	...patch,
});
const folder = (id: string, name: string, parentId: string | null = null, position = 0): Folder => ({
	id,
	collection: "media",
	parentId,
	name,
	position,
	version: 1,
});
const folders = [
	folder("blog", "Blog Assets"),
	folder("covers", "covers", "blog"),
	folder("wall", "Wallpapers", null, 1),
];

describe("what the list asks for", () => {
	it("MEDIA-B1 looks into the open folder only, and at the top asks for the files in no folder", () => {
		expect(mediaListParams(state()).get("folderId")).toBe("null");
		const inside = mediaListParams(state({ folder: "blog" }));
		expect(inside.get("folderId")).toBe("blog");
		expect(inside.has("includeDescendants")).toBe(false);
	});

	it("MEDIA-B1 searches the open folder with what is inside it, and widens to everywhere on request", () => {
		for (const patch of [{ search: " cover " }, { alt: "none" }] as const) {
			const here = mediaListParams(state({ folder: "blog", ...patch }));
			expect(here.get("folderId")).toBe("blog");
			expect(here.get("includeDescendants")).toBe("true");
			const everywhere = mediaListParams(state({ folder: "blog", scope: "all", ...patch }));
			expect(everywhere.has("folderId")).toBe(false);
			expect(everywhere.has("includeDescendants")).toBe(false);
		}
		expect(mediaListParams(state({ search: " cover " })).get("search")).toBe("cover");
	});

	it("MEDIA-B2 keeps looking into the open folder only while the type or the use narrows it", () => {
		for (const patch of [{ kind: "file" }, { used: "unused" }] as const) {
			const params = mediaListParams(state({ folder: "blog", ...patch }));
			expect(params.get("folderId")).toBe("blog");
			expect(params.has("includeDescendants")).toBe(false);
			expect(isSearching(state(patch))).toBe(false);
			expect(isFiltered(state(patch))).toBe(true);
		}
		expect(isSearching(state({ alt: "has" }))).toBe(true);
		expect(isSearching(state({ search: " a " }))).toBe(true);
		expect(hasScope(state({ folder: "blog", kind: "file" }))).toBe(false);
		expect(hasScope(state({ folder: "blog", alt: "none" }))).toBe(true);
	});

	it("MEDIA-B2 sends the conditions that are on and leaves the others out", () => {
		const params = mediaListParams(state({ alt: "none", kind: "image", used: "used", page: 2, pageSize: 50 }));
		expect(Object.fromEntries(params)).toMatchObject({
			alt: "none",
			kind: "image",
			used: "used",
			page: "2",
			pageSize: "50",
		});
		expect(mediaListParams(state()).has("alt")).toBe(false);
	});

	it("MEDIA-B6 sends the order unless it is the newest upload first", () => {
		expect(mediaListParams(state()).has("sort")).toBe(false);
		expect(mediaListParams(state({ sort: "size" })).get("sort")).toBe("size");
		expect(mediaCountsParams(state({ sort: "size" })).has("sort")).toBe(false);
	});

	it("MEDIA-B1 offers the place to look only inside a folder with something on", () => {
		expect(hasScope(state({ search: "x" }))).toBe(false);
		expect(hasScope(state({ folder: "blog" }))).toBe(false);
		expect(hasScope(state({ folder: "blog", alt: "has" }))).toBe(true);
		expect(isFiltered(state({ search: "  " }))).toBe(false);
	});
});

describe("what the counts ask for", () => {
	it("MEDIA-B2 count in the place a filter looks in, with the search and usage but without the type and alt text conditions", () => {
		const params = mediaCountsParams(
			state({ folder: "blog", search: "cover", kind: "file", alt: "none", used: "used" }),
		);
		expect(Object.fromEntries(params)).toEqual({
			page: "1",
			pageSize: "1",
			used: "used",
			search: "cover",
			folderId: "blog",
			includeDescendants: "true",
		});
		expect(mediaCountsParams(state({ folder: "blog", scope: "all" })).has("folderId")).toBe(false);
	});
});

describe("kind", () => {
	it("MEDIA-B2 is a box each: pressing one sets it, pressing again or the other one means no condition", () => {
		expect(toggleKind("all", "file")).toBe("file");
		expect(toggleKind("file", "file")).toBe("all");
		expect(toggleKind("file", "image")).toBe("all");
	});

	it("MEDIA-B2 drops the alt text condition when the kind is files, since a file has none", () => {
		expect(withKind("file")).toEqual({ kind: "file", alt: "all" });
		expect(withKind("image")).toEqual({ kind: "image" });
	});
});

describe("folders", () => {
	it("MEDIA-B1 gives the way down to a folder and a path for a file", () => {
		expect(folderTrail(folders, "covers").map((f) => f.name)).toEqual(["Blog Assets", "covers"]);
		expect(folderTrail(folders, "")).toEqual([]);
	});

	it("MEDIA-B1 writes where a file is from the open folder: nothing in it, the way down below it, the whole path elsewhere", () => {
		expect(folderPathBelow(folders, "blog", "blog", "none")).toBeNull();
		expect(folderPathBelow(folders, null, null, "none")).toBeNull();
		expect(folderPathBelow(folders, "blog", "covers", "none")).toBe("covers");
		expect(folderPathBelow(folders, null, "covers", "none")).toBe("Blog Assets / covers");
		expect(folderPathBelow(folders, "covers", "blog", "none")).toBe("Blog Assets");
		expect(folderPathBelow(folders, "blog", null, "none")).toBe("none");
	});

	it("MEDIA-B3 lists the choices in tree order with their depth, leaving out the file's own folder", () => {
		expect(folderChoices(folders).map((c) => [c.folder.name, c.depth])).toEqual([
			["Blog Assets", 0],
			["covers", 1],
			["Wallpapers", 0],
		]);
		expect(folderChoices(folders, new Set(["blog"])).map((c) => c.folder.name)).toEqual(["covers", "Wallpapers"]);
	});
});

describe("select all", () => {
	it("MEDIA-B2 reads the pick against what matches", () => {
		expect(selectAllState(0, 3)).toBe("none");
		expect(selectAllState(2, 3)).toBe("some");
		expect(selectAllState(3, 3)).toBe("all");
	});
});
