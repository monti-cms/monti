import { createTranslator } from "@monti-cms/core/client";
import { apiErrorMessages } from "./api-error-message.messages";

const t = createTranslator(apiErrorMessages);

export const MEDIA_NOT_CONFIGURED = t("error.media_not_configured");

export type CmsIssue = {
	code?: string;
	message?: string;
	path?: string;
	position?: { line: number; column: number };
};

/** 사전에 있는 코드인가(모르는 코드는 서버 `message`를 그대로 보인다). */
const hasMessage = (key: string): key is Parameters<typeof t>[0] => key in apiErrorMessages.messages.en;

export function cmsApiIssues(payload: unknown): CmsIssue[] {
	if (!payload || typeof payload !== "object") return [];
	const issues = (payload as { issues?: unknown }).issues;
	return Array.isArray(issues)
		? issues.filter((issue): issue is CmsIssue => Boolean(issue && typeof issue === "object"))
		: [];
}

/** 이슈의 `message`가 대상(속성 이름·주소·파서 오류)을 알려 주는 코드. 안내 문구 뒤에 붙인다. */
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

function fieldIssueText(code: string | undefined, label: string): string | undefined {
	if (code === "missing_field") return t("field.missing", { label });
	if (code === "field_too_long") return t("field.tooLong", { label });
	return undefined;
}

export function cmsIssueMessage(issue: CmsIssue): string {
	// 필드 문제(필수값·글자 수)는 오류 코드가 필드와 상관없이 같고 `message`에 필드 이름표가 온다.
	const field = issue.message ? fieldIssueText(issue.code, issue.message) : undefined;
	const known =
		field ?? (issue.code && hasMessage(`issue.${issue.code}`) ? t(`issue.${issue.code}` as never) : undefined);
	const detail = known && issue.code && DETAILED_CODES.has(issue.code) && issue.message ? ` — ${issue.message}` : "";
	const label = known ? `${known}${detail}` : issue.message || issue.code || t("validationFailed");
	const location = issue.position ? t("position", issue.position) : issue.path;
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
