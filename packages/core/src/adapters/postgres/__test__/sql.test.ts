import { describe, expect, it } from "vitest";
import { likeContainsPattern, likePrefixPattern } from "../store/sql";

describe("LIKE patterns", () => {
	it("contains pattern adds % on both sides", () => {
		expect(likeContainsPattern("hello")).toBe("%hello%");
	});

	it("prefix pattern adds % only at the end", () => {
		expect(likePrefixPattern("image/")).toBe("image/%");
	});

	it("escapes %, _, and \\ in the search term so they match literally", () => {
		expect(likeContainsPattern("100%_a\\b")).toBe("%100\\%\\_a\\\\b%");
		expect(likePrefixPattern("a_%")).toBe("a\\_\\%%");
	});
});
