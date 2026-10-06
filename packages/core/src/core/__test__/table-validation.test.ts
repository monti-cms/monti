import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../test/any-site";
import { MAX_TABLE_COLUMNS } from "../../doc/table-layout";
import type { CmsNode } from "../../doc/types";
import { prepareSnapshot } from "../snapshot";

/** Table spans of a document sent as it is (a format bounds a span when it reads its text, a document given directly is not). */
describe("table cell merge pre-publish validation of a document", () => {
	describe("a document given directly", () => {
		const docWith = (cells: Record<string, unknown>[][]) => ({
			type: "doc",
			version: 2,
			content: [
				{
					type: "table",
					content: cells.map((row) => ({
						type: "tableRow",
						content: row.map((attrs) => ({
							type: "tableCell",
							attrs,
							content: [{ type: "text", text: "x" }],
						})),
					})) as CmsNode[],
				},
			],
		});
		const reasons = async (cells: Record<string, unknown>[][]) => {
			const snap = await prepareSnapshot({
				collection: contentCollection,
				slug: "direct-table",
				metadata: { title: "표 테스트" },
				doc: docWith(cells),
			});
			return (snap.warnings ?? []).filter((w) => w.code === "invalid_table_span").map((w) => w.params?.reason);
		};

		it("warns about a span that is not a positive integer", async () => {
			expect(await reasons([[{ colspan: "abc" }]])).toContain("invalid_colspan");
			expect(await reasons([[{ rowspan: 0 }]])).toContain("invalid_rowspan");
			expect(await reasons([[{ colspan: 1.5 }]])).toContain("invalid_colspan");
		});

		it("warns about a rowspan past the last row and a span wider than the table may be", async () => {
			expect(await reasons([[{ rowspan: 5 }], [{}]])).toContain("rowspan_overflow");
			expect(await reasons([[{ colspan: MAX_TABLE_COLUMNS + 1 }]])).toContain("span_too_large");
		});

		it("names the table by its block id", async () => {
			const snap = await prepareSnapshot({
				collection: contentCollection,
				slug: "direct-table",
				metadata: { title: "표 테스트" },
				doc: docWith([[{ colspan: "abc" }]]),
			});
			const warning = (snap.warnings ?? []).find((w) => w.code === "invalid_table_span");
			expect(warning?.position?.blockId).toBe(snap.doc.content[0]?.id);
		});
	});
});
