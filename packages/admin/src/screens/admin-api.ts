import type { Site } from "@monti-cms/core/client";
import { type CmsIssue, cmsApiErrorMessage, cmsApiIssues } from "./api-error-message";
import { screensMessages } from "./messages";

/** Admin API error. The screen shows `message` as is and branches on `status` and `code`. */
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
 * Calls the admin API (the URL is built with `cmsApiUrl()`). Passing `json` sends a JSON body. A failed response is thrown as {@link CmsApiError}.
 * A network error rethrows the original `TypeError` so callers can tell it apart from being offline.
 */
export async function cmsFetch<T = unknown>(
	site: Pick<Site, "createTranslator">,
	url: string,
	init: Omit<RequestInit, "body"> & { json?: unknown; fallback?: string } = {},
): Promise<T> {
	const { json, fallback = site.createTranslator(screensMessages)("api.fallback"), headers, ...rest } = init;
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
			cmsApiErrorMessage(site, body, fallback),
			cmsApiIssues(body),
			body,
		);
	}
	return body as T;
}

export const errorText = (site: Pick<Site, "createTranslator">, error: unknown, fallback: string) =>
	error instanceof CmsApiError
		? error.message
		: error instanceof TypeError
			? site.createTranslator(screensMessages)("api.network")
			: fallback;
