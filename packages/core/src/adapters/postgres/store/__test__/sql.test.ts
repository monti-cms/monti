import { describe, expect, it } from "vitest";
import { likeContainsPattern, likePrefixPattern } from "../sql";

describe("LIKE patterns", () => {
	it("escapes %, _, and \\ in the search term so they match literally", () => {
		expect(likeContainsPattern("100%_a\\b")).toBe("%100\\%\\_a\\\\b%");
		expect(likePrefixPattern("a_%")).toBe("a\\_\\%%");
	});
});
