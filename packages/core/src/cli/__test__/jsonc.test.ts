import { describe, expect, it } from "vitest";
import { parseJsonc } from "../jsonc";

describe("monti command helpers", () => {
	it("DOC-B1 reads tsconfig with comments and trailing commas", () => {
		expect(parseJsonc('{ // a\n "a": "x//y", /* b */ "c": [1,], }')).toEqual({ a: "x//y", c: [1] });
		expect(parseJsonc("{ nope")).toBeUndefined();
	});
});
