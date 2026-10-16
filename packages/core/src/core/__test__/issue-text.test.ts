import { describe, expect, it } from "vitest";
import { testSite } from "../../../test/site";
import { issueMessages, issueText, tellIssues } from "../issue-text";

const t = testSite.createTranslator(issueMessages);

describe("issueText", () => {
	it("names the field of a required or too long value from its label, and puts the field path in where", () => {
		expect(issueText(testSite, { code: "missing_field", path: "title", message: "Headline" })).toEqual({
			text: t("field.missing", { label: "Headline" }),
			where: "title",
		});
		expect(issueText(testSite, { code: "field_too_long", message: "Headline" })).toEqual({
			text: t("field.tooLong", { label: "Headline" }),
		});
		// Without a label, the code's own text.
		expect(issueText(testSite, { code: "missing_field", path: "x" })).toEqual({ text: t("missing_field"), where: "x" });
	});

	it("puts the line and column of a body text in where, before the field path", () => {
		const told = issueText(testSite, { code: "mdx_error", path: "body", position: { line: 4, column: 7 } });
		expect(told).toEqual({ text: t("mdx_error"), where: t("position", { line: 4, column: 7 }) });
		// A block id is a position for the editor, not a place a person reads.
		expect(issueText(testSite, { code: "missing_image_alt", path: "body", position: { blockId: "b1" } })).toEqual({
			text: t("missing_image_alt"),
			where: "body",
		});
	});

	it("adds the target a detailed code's message names after the code's text", () => {
		const told = issueText(testSite, { code: "footnote_definition_missing", message: "gone" });
		expect(told.text.startsWith(t("footnote_definition_missing"))).toBe(true);
		expect(told.text.indexOf("gone")).toBeGreaterThan(t("footnote_definition_missing").length);
		const option = issueText(testSite, { code: "unknown_select_value", path: "policy", message: "old-option" });
		expect(option.text).toContain("old-option");
		expect(option.text).not.toContain("unknown_select_value");
		// A code that names no target keeps its message out of the text.
		expect(issueText(testSite, { code: "orphaned_metadata_key", path: "oldField", message: "oldField" }).text).toBe(
			t("orphaned_metadata_key"),
		);
	});

	it("shows a code it has no text for as the issue's own message, which a hook writes for a person", () => {
		expect(issueText(testSite, { code: "slug_has_uppercase", message: "Use lowercase letters." }).text).toBe(
			"Use lowercase letters.",
		);
		expect(issueText(testSite, { code: "slug_has_uppercase" }).text).toBe(t("unknown"));
	});

	it("reads a request value by its zod code and never shows the library's words", () => {
		const required = issueText(testSite, {
			code: "invalid_type",
			path: ["metadata", "title"],
			message: "Invalid input: expected string, received undefined",
		});
		expect(required).toEqual({ text: t("missing_field"), where: "metadata.title" });
		expect(
			issueText(testSite, { code: "too_small", message: "Too small: expected string to have >=1 characters" }).text,
		).toBe(t("missing_field"));
		expect(
			issueText(testSite, { code: "too_big", message: "Too big: expected string to have <=80 characters" }).text,
		).toBe(t("field_too_long"));
		for (const code of ["invalid_value", "invalid_union", "invalid_format", "unrecognized_keys", "custom"]) {
			expect(issueText(testSite, { code, message: "Invalid input" }).text).toBe(t("invalid_value"));
		}
	});

	it("tellIssues keeps every position the editor goes to", () => {
		const issue = { code: "missing_block_attribute", message: "src", path: "body", position: { blockId: "b1" } };
		expect(tellIssues(testSite, [issue])).toEqual([{ ...issue, ...issueText(testSite, issue) }]);
	});
});
