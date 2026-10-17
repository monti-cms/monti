import { apiErrorMessages } from "./error-message.messages.js";
/** Text shown where the server answers that media storage is not configured. */
export const mediaNotConfiguredMessage = (site) => site.createTranslator(apiErrorMessages)("mediaNotConfigured");
export function cmsApiIssues(payload) {
    if (!payload || typeof payload !== "object")
        return [];
    const issues = payload.issues;
    return Array.isArray(issues)
        ? issues.filter((issue) => Boolean(issue && typeof issue === "object"))
        : [];
}
/** The issue as one line: its text, and its place after it. */
export const issueLine = (issue) => issue.where ? `${issue.text} (${issue.where})` : issue.text;
export function cmsApiErrorMessage(site, payload, fallback) {
    if (!payload || typeof payload !== "object")
        return fallback;
    const body = payload;
    const issues = cmsApiIssues(payload);
    if (issues.length > 0) {
        const t = site.createTranslator(apiErrorMessages);
        return `${t("validationFailedList")}\n${issues.map((issue) => `• ${issueLine(issue)}`).join("\n")}`;
    }
    // The server writes `message` in the admin language (and `fix` next to it).
    return typeof body.message === "string" && body.message ? body.message : fallback;
}
