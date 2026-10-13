import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readReferenceOccurrences } from "../../types";
import { isReferencesEqual } from "../references";

describe("isReferencesEqual", () => {
	it("counts the block id as part of an occurrence when comparing references", () => {
		const reference = (blockId?: string) => ({
			kind: "media" as const,
			targetId: randomUUID(),
			isStale: false,
			occurrences: [{ type: "body" as const, ...(blockId ? { blockId } : {}) }],
		});
		const base = reference("aaaaaaaa");
		expect(isReferencesEqual([base], [{ ...base, occurrences: [{ ...base.occurrences[0] }] }])).toBe(true);
		expect(
			isReferencesEqual([base], [{ ...base, occurrences: [{ ...base.occurrences[0], blockId: "bbbbbbbb" }] }]),
		).toBe(false);
		expect(isReferencesEqual([base], [{ ...base, occurrences: [{ type: "body" }] }])).toBe(false);
	});

	it("reads the stored occurrences", () => {
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
