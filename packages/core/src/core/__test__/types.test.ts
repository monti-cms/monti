import { describe, expect, it } from "vitest";
import { readReferenceOccurrences } from "../types";

describe("isReferencesEqual", () => {
	it("MEDIA-B5 reads the stored occurrences", () => {
		const stored = [
			{ type: "metadata", path: "tagIds", ordinal: 1 },
			{ type: "body", blockId: "bbbbbbbb" },
			{ type: "body" },
		];
		expect(readReferenceOccurrences(stored)).toEqual(stored);
		// What is not an occurrence is dropped, and a row without occurrences reads as none.
		expect(readReferenceOccurrences([{ type: "other" }, { type: "mdx", line: 1, column: 1 }, null, 4])).toEqual([]);
		expect(readReferenceOccurrences(null)).toEqual([]);
	});
});
