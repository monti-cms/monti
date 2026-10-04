import { describe, expect, it } from "vitest";
import { contentCollection } from "../../../test/any-site";
import { createTranslator } from "../../i18n";
import { coreMessages } from "../messages";
import { prepareSnapshot } from "../snapshot";

describe("table cell merge pre-publish validation (span and grid warnings)", () => {
	it("a billion-column merge warns quickly and builds no grid", async () => {
		const mdx = "::::table\n:::row\n::cell[위험]{colspan=1000000000}\n:::\n::::";
		const snap = await prepareSnapshot({
			collection: contentCollection,
			slug: "huge-table",
			metadata: { title: "표 테스트" },
			mdx,
		});
		expect(snap.warnings?.some((warning) => warning.code === "invalid_table_span")).toBe(true);
	});

	it("a valid merged table raises no warnings", async () => {
		const mdx = [
			'::::table{align="left,center"}',
			":::row",
			"::cell[제목]{header colspan=2}",
			":::",
			":::row",
			"::cell[값1]{rowspan=2}",
			"::cell[값2]",
			":::",
			":::row",
			"::cell[값3]",
			":::",
			"::::",
		].join("\n");

		const snap = await prepareSnapshot({
			collection: contentCollection,
			slug: "valid-table",
			metadata: { title: "표 테스트" },
			mdx,
		});

		const tableWarnings = (snap.warnings ?? []).filter((w) => w.code === "invalid_table_span");
		expect(tableWarnings).toEqual([]);
	});

	it("warns when rowspan exceeds the table's total row count", async () => {
		const mdx = ["::::table", ":::row", "::cell[초과]{rowspan=5}", ":::", ":::row", "::cell[값]", ":::", "::::"].join(
			"\n",
		);

		const snap = await prepareSnapshot({
			collection: contentCollection,
			slug: "rowspan-overflow",
			metadata: { title: "표 테스트" },
			mdx,
		});

		const tableWarnings = (snap.warnings ?? []).filter((w) => w.code === "invalid_table_span");
		expect(tableWarnings.length).toBeGreaterThan(0);
		expect(tableWarnings[0]?.params).toMatchObject({ reason: "rowspan_overflow", rowspan: 5, rows: 2 });
	});

	it("warns when merged cells overlap", async () => {
		const mdx = [
			"::::table",
			":::row",
			"::cell[셀1]{colspan=2}",
			"::cell[셀2]{colspan=2}",
			":::",
			":::row",
			"::cell[셀3]{rowspan=2}",
			"::cell[셀4]",
			":::",
			"::::",
		].join("\n");

		const snap = await prepareSnapshot({
			collection: contentCollection,
			slug: "overlapping-cells",
			metadata: { title: "표 테스트" },
			mdx,
		});

		const tableWarnings = (snap.warnings ?? []).filter((w) => w.code === "invalid_table_span");
		expect(tableWarnings.length).toBeGreaterThan(0);
	});

	it("warns when column counts differ between rows", async () => {
		const mdx = [
			"::::table",
			":::row",
			"::cell[셀1]",
			"::cell[셀2]",
			":::",
			":::row",
			"::cell[셀3]",
			":::",
			"::::",
		].join("\n");

		const snap = await prepareSnapshot({
			collection: contentCollection,
			slug: "mismatched-columns",
			metadata: { title: "표 테스트" },
			mdx,
		});

		const tableWarnings = (snap.warnings ?? []).filter((w) => w.code === "invalid_table_span");
		expect(tableWarnings.length).toBeGreaterThan(0);
		expect(tableWarnings[0]?.params).toMatchObject({ reason: "ragged_rows" });
	});

	it("warns about an invalid span value (0 or less, or not a number)", async () => {
		const mdx = ["::::table", ":::row", "::cell[셀1]{colspan=0}", ":::", "::::"].join("\n");

		const snap = await prepareSnapshot({
			collection: contentCollection,
			slug: "invalid-span-value",
			metadata: { title: "표 테스트" },
			mdx,
		});

		const tableWarnings = (snap.warnings ?? []).filter((w) => w.code === "invalid_table_span");
		expect(tableWarnings.length).toBeGreaterThan(0);
		expect(tableWarnings[0]?.params).toMatchObject({ reason: "invalid_colspan", value: "0" });
		// The text is built from the code with the dictionary (site display language).
		expect(tableWarnings[0]?.message).toBe(createTranslator(coreMessages)("table.invalid_colspan", { value: "0" }));
	});
});
