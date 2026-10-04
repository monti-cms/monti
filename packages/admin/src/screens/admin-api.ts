import { createTranslator } from "@monti-cms/core/client";
import { type CmsIssue, cmsApiErrorMessage, cmsApiIssues } from "./api-error-message";
import { screensMessages } from "./messages";

const t = createTranslator(screensMessages);

/** 관리자 API 오류. 화면은 `message`를 그대로 보여 주고, 분기는 `status`·`code`로 한다. */
export class CmsApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string | undefined,
		message: string,
		readonly issues: CmsIssue[],
		readonly body: Record<string, unknown>,
	) {
		super(message);
		this.name = "CmsApiError";
	}
}

/**
 * 관리자 API 호출(주소는 `cmsApiUrl()`로 만든다). `json`을 주면 JSON 본문으로 보낸다. 실패 응답은 {@link CmsApiError}로 던진다.
 * 네트워크 오류는 원래 `TypeError`를 그대로 던져 호출자가 오프라인과 구분할 수 있게 한다.
 */
export async function cmsFetch<T = unknown>(
	url: string,
	init: Omit<RequestInit, "body"> & { json?: unknown; fallback?: string } = {},
): Promise<T> {
	const { json, fallback = t("api.fallback"), headers, ...rest } = init;
	const response = await fetch(url, {
		...rest,
		headers: json === undefined ? headers : { "Content-Type": "application/json", ...headers },
		body: json === undefined ? undefined : JSON.stringify(json),
	});
	if (response.status === 204) return undefined as T;
	const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
	if (!response.ok) {
		throw new CmsApiError(
			response.status,
			typeof body.code === "string" ? body.code : undefined,
			cmsApiErrorMessage(body, fallback),
			cmsApiIssues(body),
			body,
		);
	}
	return body as T;
}

export const errorText = (error: unknown, fallback: string) =>
	error instanceof CmsApiError ? error.message : error instanceof TypeError ? t("api.network") : fallback;
