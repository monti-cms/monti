import { describe, expect, it } from "vitest";
import { readTrashState, trashQueryOf, writeTrashState } from "./trash-query";

const state = (search: string) => readTrashState(new URLSearchParams(search));

describe("the trash's address", () => {
	it("an address with nothing in it is the trash just opened, and writes back to nothing", () => {
		expect(state("")).toEqual({
			folder: null,
			search: "",
			everywhere: false,
			kinds: [],
			sort: "newest",
			page: 1,
			open: null,
		});
		expect(writeTrashState(state("")).toString()).toBe("");
	});

	it("what is in the address comes back as it was written", () => {
		const written = writeTrashState({
			folder: "f1",
			search: "리액트",
			everywhere: true,
			kinds: ["post", "media"],
			sort: "oldest",
			page: 3,
			open: { kind: "media", id: "m:1" },
		});
		expect(state(written.toString())).toEqual({
			folder: "f1",
			search: "리액트",
			everywhere: true,
			kinds: ["post", "media"],
			sort: "oldest",
			page: 3,
			open: { kind: "media", id: "m:1" },
		});
	});

	it("what the address cannot mean is left out", () => {
		expect(state("page=0&sort=sideways&open=folder:f1")).toMatchObject({ page: 1, sort: "newest", open: null });
		expect(state("open=entry:")).toMatchObject({ open: null });
	});

	it("the whole trash is searched only while there are words to search for", () => {
		expect(trashQueryOf(state("folder=f1&in=all"))).toMatchObject({ folder: "f1", scope: "here" });
		expect(trashQueryOf(state("folder=f1&in=all&q=a"))).toMatchObject({ scope: "all", search: "a" });
		expect(trashQueryOf(state(""))).not.toHaveProperty("folder");
	});
});
