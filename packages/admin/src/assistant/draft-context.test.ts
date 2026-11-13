import type { Doc } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { draftContext } from "./draft-context";

const paragraph = (id: string, text: string) => ({ id, type: "paragraph", content: [{ type: "text", text }] });

describe("the unsaved values that go along with a request (doc 10, context)", () => {
	it("10-1 nothing unsaved is nothing sent", () => {
		expect(draftContext([])).toBeUndefined();
	});

	it("10-1 each changed place goes with its value now; an emptied place goes as empty", () => {
		expect(
			draftContext([
				{ path: "title", after: "새 제목" },
				{ path: "values.summary", after: undefined },
			]),
		).toEqual({ title: "새 제목", "values.summary": null });
	});

	it("10-1 a body too large for the request is cut at a block, and says how many of its blocks went", () => {
		const blocks = Array.from({ length: 40 }, (_, index) => paragraph(`b_${index}`, "가".repeat(100)));
		const doc = { type: "doc", blocks } as unknown as Doc;
		const sent = draftContext(
			[
				{ path: "title", after: "새 제목" },
				{ path: "doc", after: doc },
			],
			2000,
		);
		expect(JSON.stringify(sent).length).toBeLessThanOrEqual(2000);
		const cut = sent?.docCut as { blocks: number; of: number };
		expect(cut.of).toBe(40);
		expect(cut.blocks).toBeGreaterThan(5);
		expect(cut.blocks).toBeLessThan(40);
		// Whole blocks from the start, in order; the other places are all there.
		expect((sent?.doc as Doc).blocks).toEqual(blocks.slice(0, cut.blocks));
		expect(sent?.title).toBe("새 제목");
	});

	it("10-1 a body that fits goes whole, with no note", () => {
		const doc = { type: "doc", blocks: [paragraph("b_1", "짧은 글")] } as unknown as Doc;
		expect(draftContext([{ path: "doc", after: doc }])).toEqual({ doc });
	});
});
