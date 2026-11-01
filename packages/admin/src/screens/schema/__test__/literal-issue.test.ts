import type { SchemaLiteralIssueCode } from "@monti-cms/core/internal/schema-edit";
import { describe, expect, it } from "vitest";
import { testSite } from "../../../../../core/test/site";
import { describeLiteralIssue } from "../literal-issue";
import { schemaMessages } from "../messages";

const t = testSite.createTranslator(schemaMessages);

const SAMPLE: Record<SchemaLiteralIssueCode, Record<string, string>> = {
	comment_unclosed: {},
	string_unclosed: {},
	escape_malformed: {},
	template_expression: {},
	expected_token: { expected: ")" },
	expected_value: {},
	expected_name: { found: "]" },
	expected_import: {},
	expected_module: {},
	expected_schema_object: { found: "[" },
	computed_key: {},
	spread: {},
	method: { name: "build" },
	shorthand: { name: "defaultLocale" },
	proto_key: {},
	duplicate_key: { name: "a" },
	empty_slot: {},
	not_data: { found: "+" },
	call: { name: "build" },
	access: { name: "process" },
	identifier: { name: "locale" },
	foreign_module: {},
	second_import: {},
	code_before: { name: "const" },
	code_after: {},
};

describe("describeLiteralIssue", () => {
	it.each(
		Object.entries(SAMPLE),
	)("SCHEMA-F12 words %s in the admin language, with its line and the names it mentions", (code, params) => {
		const text = describeLiteralIssue(t, { code: code as SchemaLiteralIssueCode, params, line: 7, column: 1 });
		// The line is named, and no placeholder is left unfilled.
		expect(text).toContain("7");
		expect(text).not.toMatch(/\{[a-z]+\}/);
		for (const value of Object.values(params)) expect(text).toContain(value);
	});

	it.runIf(testSite.ADMIN_LANGUAGE !== "en")(
		"SCHEMA-F12 does not show the English sentence of the server in an admin in another language",
		() => {
			const text = describeLiteralIssue(t, { code: "second_import", params: {}, line: 2, column: 1 });
			expect(text).not.toMatch(/a second import|Line 2|line 2/);
		},
	);
});
