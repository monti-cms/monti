import type { Site } from "@monti-cms/core/site";
import { isSandboxSite, isWrite } from "../screens/shared/preview-sandbox";
import { type CmsIssue, cmsApiErrorMessage, cmsApiIssues } from "./error-message";
import { apiErrorMessages } from "./error-message.messages";

/** Admin API error. The screen shows `message` as is and branches on `status` and `code`. */
export class CmsApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string | undefined,
		message: string,
		readonly issues: CmsIssue[],
		/** The `error` object of the answer: `code`, `message`, and `issues` / `details` when there are any. */
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
	const { json, fallback = site.createTranslator(apiErrorMessages)("fallback"), headers, ...rest } = init;
	// A preview runs on a draft site and must not write.
	if (isSandboxSite(site) && isWrite(rest.method)) {
		throw new CmsApiError(0, "preview", site.createTranslator(apiErrorMessages)("previewNoWrite"), [], {});
	}
	const response = await fetch(url, {
		...rest,
		headers: json === undefined ? headers : { "Content-Type": "application/json", ...headers },
		body: json === undefined ? undefined : JSON.stringify(json),
	});
	if (response.status === 204) return undefined as T;
	const body = (await response.json().catch(() => ({}))) as Record<string, unknown>;
	if (!response.ok) {
		// Every error answer is `{ error: { code, message, issues?, details? } }`.
		const error = (typeof body.error === "object" && body.error !== null ? body.error : {}) as Record<string, unknown>;
		throw new CmsApiError(
			response.status,
			typeof error.code === "string" ? error.code : undefined,
			cmsApiErrorMessage(site, error, fallback),
			cmsApiIssues(error),
			error,
		);
	}
	return body as T;
}

/** Whether the server refused a write because the record changed since it was read (HTTP 409 `conflict`). */
export const isConflict = (error: unknown): boolean =>
	error instanceof CmsApiError && error.status === 409 && error.code === "conflict";

/**
 * The one place an error becomes text for the user. An API error shows its own message (which already lists the `issues` the server found),
 * a network error shows the offline text, and anything else shows `fallback`.
 */
export const errorText = (site: Pick<Site, "createTranslator">, error: unknown, fallback: string): string =>
	error instanceof CmsApiError
		? error.message || fallback
		: error instanceof TypeError
			? site.createTranslator(apiErrorMessages)("network")
			: fallback;
