import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../test/any-site";
import { mdxOf } from "../../../test/stored-content";
import { createTranslator } from "../../i18n";
import { MAX_TABLE_COLUMNS } from "../../mdx/table-layout";
import type { CmsNode } from "../../mdx/types";
import { coreMessages } from "../messages";
import { prepareSnapshot } from "../snapshot";

/** A merged table as standard MDX: `<Table>` of `<TableRow>` of `<TableCell>`. */
const cell = (text: string, attrs = "") => `<TableCell${attrs ? ` ${attrs}` : ""}>${text}</TableCell>`;
const table = (rows: string[][]) =>
	["<Table>", ...rows.flatMap((cells) => ["<TableRow>", ...cells, "</TableRow>"]), "</Table>"].join("\n");

/**
 * The body is checked as it is stored: written from its document, where a span is bounded (`boundedTableSpan`). So a span that is not a positive integer,
 * or a rowspan past the last row, never reaches the check: it is stored as a valid value (or none), and only what that leaves behind can warn.
 */
describe("table cell merge pre-publish validation (span and grid warnings)", () => {
	it("a billion-column merge is stored as the largest span and warns quickly without building a grid", async () => {
		// The merge starts at the second column: stored as the largest span, it still runs past the table's allowed width.
		const mdx = table([[cell("앞"), cell("위험", 'colspan="1000000000"')]]);
		const snap = await prepareSnapshot({
			collection: contentCollection,
			slug: "huge-table",
			metadata: { title: "표 테스트" },
			format: "mdx",
			body: mdx,
		});
		expect(mdxOf(snap.doc)).not.toContain("1000000000");
		expect(mdxOf(snap.doc)).toContain(`colspan="${MAX_TABLE_COLUMNS}"`);
		const tableWarnings = (snap.warnings ?? []).filter((warning) => warning.code === "invalid_table_span");
		expect(tableWarnings[0]?.params).toMatchObject({ reason: "span_too_large", max: MAX_TABLE_COLUMNS });
		// The text is built from the code with the dictionary (site display language).
		expect(tableWarnings[0]?.message).toBe(
			createTranslator(coreMessages)("table.span_too_large", { max: MAX_TABLE_COLUMNS }),
		);
	});

	it("a valid merged table raises no warnings", async () => {
		const mdx = [
			'<Table align="left,center">',
			"<TableRow>",
			cell("제목", 'header colspan="2"'),
			"</TableRow>",
			"<TableRow>",
			cell("값1", 'rowspan="2"'),
			cell("값2"),
			"</TableRow>",
			"<TableRow>",
			cell("값3"),
			"</TableRow>",
			"</Table>",
		].join("\n");

		const snap = await prepareSnapshot({
			collection: contentCollection,
			slug: "valid-table",
			metadata: { title: "표 테스트" },
			format: "mdx",
			body: mdx,
		});

		const tableWarnings = (snap.warnings ?? []).filter((w) => w.code === "invalid_table_span");
		expect(tableWarnings).toEqual([]);
	});

	it("stores a rowspan past the last row as the remaining rows, and warns about the layout that leaves", async () => {
		const mdx = table([[cell("초과", 'rowspan="5"')], [cell("값")]]);

		const snap = await prepareSnapshot({
			collection: contentCollection,
			slug: "rowspan-overflow",
			metadata: { title: "표 테스트" },
			format: "mdx",
			body: mdx,
		});

		// `rowspan_overflow` cannot be reached through a snapshot any more: the stored span never passes the last row.
		expect(mdxOf(snap.doc)).not.toContain('rowspan="5"');
		expect(mdxOf(snap.doc)).toContain('rowspan="2"');
		const tableWarnings = (snap.warnings ?? []).filter((w) => w.code === "invalid_table_span");
		expect(tableWarnings.map((warning) => warning.params?.reason)).not.toContain("rowspan_overflow");
		expect(tableWarnings[0]?.params).toMatchObject({ reason: "ragged_rows" });
	});

	it("warns when merged cells overlap", async () => {
		const mdx = table([
			[cell("셀1", 'colspan="2"'), cell("셀2", 'colspan="2"')],
			[cell("셀3", 'rowspan="2"'), cell("셀4")],
		]);

		const snap = await prepareSnapshot({
			collection: contentCollection,
			slug: "overlapping-cells",
			metadata: { title: "표 테스트" },
			format: "mdx",
			body: mdx,
		});

		const tableWarnings = (snap.warnings ?? []).filter((w) => w.code === "invalid_table_span");
		expect(tableWarnings.length).toBeGreaterThan(0);
	});

	it("warns when column counts differ between rows", async () => {
		const mdx = table([[cell("셀1"), cell("셀2")], [cell("셀3")]]);

		const snap = await prepareSnapshot({
			collection: contentCollection,
			slug: "mismatched-columns",
			metadata: { title: "표 테스트" },
			format: "mdx",
			body: mdx,
		});

		const tableWarnings = (snap.warnings ?? []).filter((w) => w.code === "invalid_table_span");
		expect(tableWarnings.length).toBeGreaterThan(0);
		expect(tableWarnings[0]?.params).toMatchObject({ reason: "ragged_rows" });
	});

	it("stores an invalid span value (0 or less, or not a number) as no merge, so it raises no warning", async () => {
		for (const [attribute, value] of [
			["colspan", "0"],
			["colspan", "-2"],
			["rowspan", "abc"],
		] as const) {
			const snap = await prepareSnapshot({
				collection: contentCollection,
				slug: "invalid-span-value",
				metadata: { title: "표 테스트" },
				format: "mdx",
				body: table([[cell("셀1", `${attribute}="${value}"`)]]),
			});

			// `invalid_colspan` and `invalid_rowspan` cannot be reached through a snapshot any more: the value is gone from the stored text.
			expect(mdxOf(snap.doc)).not.toContain(`${attribute}=`);
			expect((snap.warnings ?? []).filter((w) => w.code === "invalid_table_span")).toEqual([]);
		}
	});

	describe("a document given directly (its spans are not bounded by reading MDX)", () => {
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
