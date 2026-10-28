import { describe, expect, it } from "vitest";
import { parseTrashState, trashStateToParams, trashStateToSearchParams } from "../trash-state";

const parse = (query: string) => parseTrashState(new URLSearchParams(query));
/** The state of an address that says nothing. */
const DEFAULT_TRASH_STATE = parse("");

describe("the trash's address", () => {
	it("starts at every kind, the top, no search, newest first, the first page", () => {
		expect(DEFAULT_TRASH_STATE).toEqual({
			kinds: [],
			folder: null,
			trail: [],
			search: "",
			direction: "desc",
			page: 1,
			pageSize: 25,
		});
		expect(trashStateToSearchParams(DEFAULT_TRASH_STATE).toString()).toBe("");
	});

	it("writes only what differs from that and reads it back", () => {
		const state = {
			...DEFAULT_TRASH_STATE,
			kinds: ["post", "media"],
			search: "저장소",
			direction: "asc" as const,
			page: 2,
			pageSize: 50 as const,
		};
		const query = trashStateToSearchParams(state).toString();
		expect(query).toBe("kind=post&kind=media&search=%EC%A0%80%EC%9E%A5%EC%86%8C&sort=asc&page=2&pageSize=50");
		expect(parse(query)).toEqual(state);
	});

	it("keeps the way back out of nested folders", () => {
		const state = { ...DEFAULT_TRASH_STATE, folder: "c", trail: ["a", "b"] };
		expect(parse(trashStateToSearchParams(state).toString())).toEqual(state);
	});

	it("asks the server for the kinds picked at the top, and for the inside of a folder with nothing else", () => {
		expect(trashStateToParams({ ...DEFAULT_TRASH_STATE, kinds: ["media"], search: "x" })).toMatchObject({
			kinds: ["media"],
			search: "x",
		});
		const inFolder = trashStateToParams({ ...DEFAULT_TRASH_STATE, kinds: ["media"], search: "x", folder: "f" });
		expect(inFolder).toMatchObject({ folderId: "f" });
		expect(inFolder).not.toHaveProperty("kinds");
		expect(inFolder).not.toHaveProperty("search");
		expect(trashStateToParams(DEFAULT_TRASH_STATE)).not.toHaveProperty("kinds");
	});
});
