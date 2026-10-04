import { createTranslator } from "@monti-cms/core/client";
import { apiErrorMessages } from "./api-error-message.messages.js";
const t = createTranslator(apiErrorMessages);
export const MEDIA_NOT_CONFIGURED = t("error.media_not_configured");
/** Whether the code is in the dictionary (unknown codes show the server `message` as is). */
const hasMessage = (key) => key in apiErrorMessages.messages.en;
export function cmsApiIssues(payload) {
    if (!payload || typeof payload !== "object")
        return [];
    const issues = payload.issues;
    return Array.isArray(issues)
        ? issues.filter((issue) => Boolean(issue && typeof issue === "object"))
        : [];
}
/** Codes where the issue's `message` names the target (property name, slug, parser error). Appended after the guidance text. */
const DETAILED_CODES = new Set([
    "untranslated_text",
    "mdx_error",
    "missing_block_attribute",
    "invalid_block_attribute",
    "unknown_block_attribute",
    "unresolved_internal_link",
    "unpublished_internal_link",
    "image_src_not_allowed",
]);
function fieldIssueText(code, label) {
    if (code === "missing_field")
        return t("field.missing", { label });
    if (code === "field_too_long")
        return t("field.tooLong", { label });
    return undefined;
}
export function cmsIssueMessage(issue) {
    // For field problems (required, length), the error code is the same regardless of field and the field label comes in `message`.
    const field = issue.message ? fieldIssueText(issue.code, issue.message) : undefined;
    const known = field ?? (issue.code && hasMessage(`issue.${issue.code}`) ? t(`issue.${issue.code}`) : undefined);
    const detail = known && issue.code && DETAILED_CODES.has(issue.code) && issue.message ? ` — ${issue.message}` : "";
    const label = known ? `${known}${detail}` : issue.message || issue.code || t("validationFailed");
    const location = issue.position ? t("position", issue.position) : issue.path;
    return location ? `${label} (${location})` : label;
}
export function cmsApiErrorMessage(payload, fallback) {
    if (!payload || typeof payload !== "object")
        return fallback;
    const body = payload;
    const issues = cmsApiIssues(payload);
    if (issues.length > 0) {
        const details = issues.map(cmsIssueMessage);
        return `${t("validationFailedList")}\n${details.map((detail) => `• ${detail}`).join("\n")}`;
    }
    if (typeof body.code === "string" && hasMessage(`error.${body.code}`))
        return t(`error.${body.code}`);
    return typeof body.message === "string" && body.message ? body.message : fallback;
}
