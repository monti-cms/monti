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

	it("reads an occurrence stored before positions were block ids as the same occurrence in the current shape", () => {
		const stored = [
			{ type: "mdx", line: 3, column: 1, blockId: "aaaaaaaa" },
			{ type: "mdx", line: 9, column: 4 },
			{ type: "metadata", path: "tagIds", ordinal: 1 },
			{ type: "body", blockId: "bbbbbbbb" },
		];
		expect(readReferenceOccurrences(stored)).toEqual([
			{ type: "body", blockId: "aaaaaaaa" },
			{ type: "body" },
			{ type: "metadata", path: "tagIds", ordinal: 1 },
			{ type: "body", blockId: "bbbbbbbb" },
		]);
		// What is not an occurrence is dropped, and a row without occurrences reads as none.
		expect(readReferenceOccurrences([{ type: "other" }, null, 4])).toEqual([]);
		expect(readReferenceOccurrences(null)).toEqual([]);
	});
});
