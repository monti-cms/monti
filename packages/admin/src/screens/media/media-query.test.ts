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
		expect(isLooking(read("kind=file&used=unused"))).toBe(false);
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
