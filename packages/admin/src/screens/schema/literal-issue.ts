import type { SchemaLiteralIssue } from "@monti-cms/core/internal/schema-edit";
import type { TranslatorFor } from "../../translator";
import type { schemaMessages } from "./messages";

type T = TranslatorFor<typeof schemaMessages>;

/**
 * The sentence for what is wrong in a schema file that holds code: the issue's code, with the names it mentions, and the line. The server also sends the English
 * sentence (`detail`), which the command line shows; the screen shows this one in the admin language.
 */
export function describeLiteralIssue(t: T, issue: SchemaLiteralIssue): string {
	const { params } = issue;
	const what = params.what ?? (params.expected ? `\`${params.expected}\`` : "");
	const vars = { ...params, what };
	// Codes that name what was found read differently without it.
	const withFound = params.found && ["expected_token", "expected_name", "expected_schema_object"].includes(issue.code);
	const key = `literal.${issue.code}${withFound ? ".found" : ""}` as Parameters<T>[0];
	return t("literal.line", { line: issue.line, message: t(key, vars) });
}
