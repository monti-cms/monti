import { createTranslator } from "@monti-cms/core/client";
import { apiErrorMessages } from "./api-error-message.messages";

const t = createTranslator(apiErrorMessages);

export const MEDIA_NOT_CONFIGURED = t("error.media_not_configured");

export type CmsIssue = {
	code?: string;
	message?: string;
	path?: string;
	/**
	 * `blockId` names the block of the stored body the issue is in, so the visual editor can go to it. A text that could not be read
	 * (`mdx_error`) has a `line` and `column` in that text instead.
	 */
	position?: { line?: number; column?: number; blockId?: string };
};

/** Whether the code is in the dictionary (unknown codes show the server `message` as is). */
const hasMessage = (key: string): key is Parameters<typeof t>[0] => key in apiErrorMessages.messages.en;

export function cmsApiIssues(payload: unknown): CmsIssue[] {
	if (!payload || typeof payload !== "object") return [];
	const issues = (payload as { issues?: unknown }).issues;
	return Array.isArray(issues)
		? issues.filter((issue): issue is CmsIssue => Boolean(issue && typeof issue === "object"))
		: [];
}

/** Codes where the issue's `message` names the target (property name, slug, parser error). Appended after the guidance text. */
const DETAILED_CODES = new Set([
	"untranslated_text",
	"mdx_error",
	"missing_block_attribute",
	"invalid_block_attribute",
	"unknown_block_attribute",
	"code_annotation_out_of_range",
	"footnote_definition_missing",
	"footnote_definition_unused",
	"footnote_definition_duplicate",
	"unknown_select_value",
	"code_ref_broken",
	"code_anchor_duplicate",
	"unresolved_internal_link",
	"unpublished_internal_link",
	"image_src_not_allowed",
]);

function fieldIssueText(code: string | undefined, label: string): string | undefined {
	if (code === "missing_field") return t("field.missing", { label });
	if (code === "field_too_long") return t("field.tooLong", { label });
	return undefined;
}

export function cmsIssueMessage(issue: CmsIssue): string {
	// For field problems (required, length), the error code is the same regardless of field and the field label comes in `message`.
	const field = issue.message ? fieldIssueText(issue.code, issue.message) : undefined;
	const known =
		field ?? (issue.code && hasMessage(`issue.${issue.code}`) ? t(`issue.${issue.code}` as never) : undefined);
	const detail = known && issue.code && DETAILED_CODES.has(issue.code) && issue.message ? ` — ${issue.message}` : "";
	const label = known ? `${known}${detail}` : issue.message || issue.code || t("validationFailed");
	const { line, column } = issue.position ?? {};
	const location = line !== undefined && column !== undefined ? t("position", { line, column }) : issue.path;
	return location ? `${label} (${location})` : label;
}

export function cmsApiErrorMessage(payload: unknown, fallback: string): string {
	if (!payload || typeof payload !== "object") return fallback;
	const body = payload as { message?: unknown; code?: unknown };
	const issues = cmsApiIssues(payload);
	if (issues.length > 0) {
		const details = issues.map(cmsIssueMessage);
		return `${t("validationFailedList")}\n${details.map((detail) => `• ${detail}`).join("\n")}`;
	}
	if (typeof body.code === "string" && hasMessage(`error.${body.code}`)) return t(`error.${body.code}` as never);
	return typeof body.message === "string" && body.message ? body.message : fallback;
}
