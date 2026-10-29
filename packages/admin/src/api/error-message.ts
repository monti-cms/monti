import type { Site } from "@monti-cms/core/site";
import { apiErrorMessages } from "./error-message.messages";

type ApiErrorSite = Pick<Site, "createTranslator">;

/** Text shown where the server answers that media storage is not configured. */
export const mediaNotConfiguredMessage = (site: ApiErrorSite): string =>
	site.createTranslator(apiErrorMessages)("mediaNotConfigured");

export type CmsIssue = {
	code?: string;
	message?: string;
	path?: string;
	/**
	 * `blockId` names the block of the stored body the issue is in, so the visual editor can go to it. A text that could not be read
	 * (`mdx_error`) has a `line` and `column` in that text instead.
	 */
	position?: { line?: number; column?: number; blockId?: string };
	/** What is wrong, in the admin language: the server writes it (`issueText` of `@monti-cms/core/site` for an issue the screen finds itself). */
	text: string;
	/** Where it is, in the admin language (a line and column of a body text, or the field path). */
	where?: string;
};

export function cmsApiIssues(payload: unknown): CmsIssue[] {
	if (!payload || typeof payload !== "object") return [];
	const issues = (payload as { issues?: unknown }).issues;
	return Array.isArray(issues)
		? issues.filter((issue): issue is CmsIssue => Boolean(issue && typeof issue === "object"))
		: [];
}

/** The issue as one line: its text, and its place after it. */
export const issueLine = (issue: Pick<CmsIssue, "text" | "where">): string =>
	issue.where ? `${issue.text} (${issue.where})` : issue.text;

/**
 * The issue as one line beside the field it is about. When its place is only that field's key (`where` is the `path`: "title", "summary"), the field
 * already says where it is and the key is an internal name, so the text stands alone; a line and column, or any other place, stays after the text.
 */
export const fieldIssueLine = (issue: Pick<CmsIssue, "text" | "where" | "path">): string =>
	issue.where && issue.where === issue.path ? issue.text : issueLine(issue);

export function cmsApiErrorMessage(site: ApiErrorSite, payload: unknown, fallback: string): string {
	if (!payload || typeof payload !== "object") return fallback;
	const body = payload as { message?: unknown; code?: unknown };
	const issues = cmsApiIssues(payload);
	if (issues.length > 0) {
		const t = site.createTranslator(apiErrorMessages);
		return `${t("validationFailedList")}\n${issues.map((issue) => `• ${issueLine(issue)}`).join("\n")}`;
	}
	// The server writes `message` in the admin language (and `fix` next to it).
	return typeof body.message === "string" && body.message ? body.message : fallback;
}
