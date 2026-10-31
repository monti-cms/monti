import { describe, expect, it } from "vitest";
import { moveWithin } from "../move-within";

describe("moveWithin", () => {
	it("SCHEMA-N5 moves an item to the index it should have afterwards", () => {
		expect(moveWithin(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
		expect(moveWithin(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]);
	});

	it("SCHEMA-N5 keeps the target inside the list", () => {
		expect(moveWithin(["a", "b", "c"], 1, -5)).toEqual(["b", "a", "c"]);
		expect(moveWithin(["a", "b", "c"], 1, 99)).toEqual(["a", "c", "b"]);
	});

	it("SCHEMA-N5 leaves the list alone for an unknown index or a move in place, and never edits its input", () => {
		const list = ["a", "b"];
		expect(moveWithin(list, 5, 0)).toEqual(["a", "b"]);
		expect(moveWithin(list, 1, 1)).toEqual(["a", "b"]);
		expect(moveWithin(list, 0, 1)).toEqual(["b", "a"]);
		expect(list).toEqual(["a", "b"]);
	});
});
