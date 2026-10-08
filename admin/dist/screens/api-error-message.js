import { apiErrorMessages } from "./api-error-message.messages.js";
/** Text shown where the server answers that media storage is not configured. */
export const mediaNotConfiguredMessage = (site) => site.createTranslator(apiErrorMessages)("error.media_not_configured");
const translatorOf = (site) => site.createTranslator(apiErrorMessages);
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
    "disallowed_block",
    "disallowed_mark",
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
function fieldIssueText(t, code, label) {
    if (code === "missing_field")
        return t("field.missing", { label });
    if (code === "field_too_long")
        return t("field.tooLong", { label });
    return undefined;
}
export function cmsIssueMessage(site, issue) {
    const t = translatorOf(site);
    // For field problems (required, length), the error code is the same regardless of field and the field label comes in `message`.
    const field = issue.message ? fieldIssueText(t, issue.code, issue.message) : undefined;
    const known = field ?? (issue.code && hasMessage(`issue.${issue.code}`) ? t(`issue.${issue.code}`) : undefined);
    const detail = known && issue.code && DETAILED_CODES.has(issue.code) && issue.message ? ` — ${issue.message}` : "";
    const label = known ? `${known}${detail}` : issue.message || issue.code || t("validationFailed");
    const { line, column } = issue.position ?? {};
    const location = line !== undefined && column !== undefined ? t("position", { line, column }) : issue.path;
    return location ? `${label} (${location})` : label;
}
export function cmsApiErrorMessage(site, payload, fallback) {
    const t = translatorOf(site);
    if (!payload || typeof payload !== "object")
        return fallback;
    const body = payload;
    const issues = cmsApiIssues(payload);
    if (issues.length > 0) {
        const details = issues.map((issue) => cmsIssueMessage(site, issue));
        return `${t("validationFailedList")}\n${details.map((detail) => `• ${detail}`).join("\n")}`;
    }
    if (typeof body.code === "string" && hasMessage(`error.${body.code}`))
        return t(`error.${body.code}`);
    return typeof body.message === "string" && body.message ? body.message : fallback;
}
