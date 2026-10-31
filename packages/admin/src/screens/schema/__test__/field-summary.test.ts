import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { fieldSheetSummary } from "../field-summary";
import { schemaFieldsMessages } from "../fields.messages";

const t = testSite.createTranslator(schemaFieldsMessages);
const file = { collections: { series: { label: "시리즈" } } };

describe("the summary line of the add-field sheet", () => {
	it("SCHEMA-N4 writes a text field as its name, kind and the settings chosen", () => {
		const field = { kind: "text", multiline: true, max: 120, localized: true };
		expect(fieldSheetSummary(t, "summary", field, file)).toBe(
			`summary · text · ${t("sum.multiline")} · 120 · ${t("summary.localized")}`,
		);
	});

	it("SCHEMA-N4 writes a relation as an arrow to the label of its target, with [] for several", () => {
		expect(fieldSheetSummary(t, "series", { kind: "relation", to: "series" }, file)).toBe("series → 시리즈");
		expect(fieldSheetSummary(t, "series", { kind: "relation", to: "series", many: true }, file)).toBe(
			"series → 시리즈[]",
		);
		expect(fieldSheetSummary(t, "series", { kind: "relation" }, file)).toBe("series → ?");
	});

	it("SCHEMA-N4 lists the options of a select and the way a value follows the source language", () => {
		const field = { kind: "select", options: { note: "메모", essay: "에세이" }, localized: "inherit" };
		expect(fieldSheetSummary(t, "format", field, file)).toBe(
			`format · select · note | essay · ${t("summary.inherit")}`,
		);
	});

	it("SCHEMA-N4 leaves out what is not set", () => {
		expect(fieldSheetSummary(t, "cover", { kind: "media" }, file)).toBe("cover · media");
	});
});
