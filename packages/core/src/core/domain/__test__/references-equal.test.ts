import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isReferencesEqual } from "../references";

describe("isReferencesEqual", () => {
	it("counts the block id as part of an occurrence when comparing references", () => {
		const reference = (blockId?: string) => ({
			kind: "media" as const,
			targetId: randomUUID(),
			isStale: false,
			occurrences: [{ type: "mdx" as const, line: 1, column: 1, ...(blockId ? { blockId } : {}) }],
		});
		const base = reference("aaaaaaaa");
		expect(isReferencesEqual([base], [{ ...base, occurrences: [{ ...base.occurrences[0] }] }])).toBe(true);
		expect(
			isReferencesEqual([base], [{ ...base, occurrences: [{ ...base.occurrences[0], blockId: "bbbbbbbb" }] }]),
		).toBe(false);
		expect(isReferencesEqual([base], [{ ...base, occurrences: [{ type: "mdx", line: 1, column: 1 }] }])).toBe(false);
	});
});
