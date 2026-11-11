import { describe, expect, it } from "vitest";
import { parseRoute } from "../../route";
import { isLooking, queryOf, readMediaState, writeMediaState } from "./media-query";

const read = (search: string) => readMediaState(new URLSearchParams(search));

describe("the library's address", () => {
	it("09-1 a library just opened has nothing to say", () => {
		const state = read("");
		expect(state).toMatchObject({
			folder: null,
			kinds: [],
			used: [],
			sort: "uploaded",
			dir: "desc",
			view: "grid",
			page: 1,
			file: null,
		});
		expect(writeMediaState(state).toString()).toBe("");
		expect(isLooking(state)).toBe(false);
	});

	it("09-1 what it says comes back the same", () => {
		const search = "folder=f1&q=cover&in=all&kind=file&used=unused&sort=size&view=list&page=2&file=m1";
		expect(writeMediaState(read(search)).toString()).toBe(search);
		expect(isLooking(read(search))).toBe(true);
		expect(isLooking(read("kind=file&used=unused"))).toBe(true);
		expect(isLooking(read("folder=f1&sort=size"))).toBe(false);
	});

	it("09-1 each order starts its own way and goes the other on request", () => {
		expect(read("sort=name")).toMatchObject({ sort: "name", dir: "asc" });
		expect(read("sort=size")).toMatchObject({ sort: "size", dir: "desc" });
		expect(queryOf(read("sort=name&dir=desc"))).toMatchObject({ sort: "name", dir: "desc" });
		expect(writeMediaState(read("sort=name&dir=desc")).toString()).toBe("sort=name&dir=desc");
		// The way an order starts is not written, and a way nothing knows is that one.
		expect(writeMediaState(read("sort=name&dir=asc")).toString()).toBe("sort=name");
		expect(read("dir=sideways")).toMatchObject({ dir: "desc" });
	});

	it("09-1 'all folders' holds only while words are looked for: a filter alone, or nothing, keeps to the folder (2026-11-10, owner)", () => {
		expect(queryOf(read("folder=f1&q=cover&in=all")).scope).toBe("all");
		expect(queryOf(read("folder=f1&kind=file&in=all")).scope).toBe("here");
		expect(queryOf(read("folder=f1&in=all")).scope).toBe("here");
	});

	it("09-1 what an old link says that nothing knows is left out", () => {
		expect(read("sort=mood&kind=video,image&used=maybe&view=cards&page=-3")).toMatchObject({
			sort: "uploaded",
			kinds: ["image"],
			used: [],
			view: "grid",
			page: 1,
		});
	});

	it("09-1 asks media.query for the open folder, or the whole library when told", () => {
		expect(queryOf(read("folder=f1"))).toMatchObject({ folder: "f1", scope: "here" });
		expect(queryOf(read("folder=f1&q=a&in=all"))).toMatchObject({ folder: "f1", scope: "all", search: "a" });
		expect(queryOf(read(""))).toMatchObject({ folder: null, scope: "here" });
	});

	it("09-1 the route knows the library and its address", () => {
		const route = parseRoute("#/media?folder=f1");
		expect(route.screen).toBe("media");
		expect(route.screen === "media" && route.params.get("folder")).toBe("f1");
	});
});
