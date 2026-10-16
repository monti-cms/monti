import { AuthError } from "../../adapters/auth";
import { ERROR_STATUS, type ErrorCode, HIDDEN_MESSAGE_CODES } from "../../core/error-codes";
import { codeNotice } from "../../core/error-notice";
import { type IssueLike, issueText } from "../../core/issue-text";
import { SetupError } from "../../core/problem";
import { CmsError, type ErrorNotice } from "../../core/store/errors";
import type { Site } from "../../site";

export { CmsError, ERROR_STATUS, type ErrorCode, type ErrorNotice };

/**
 * The error body of every answer: `{ error: { code, message, fix?, detail?, issues?, details? } }`.
 * - `message` and `fix` are for a person: what went wrong and what to do, in the admin language on an admin route.
 * - `detail` is the developer text (a library's or another service's own words), for a "details" view and bug reports. It is never the only text shown.
 * - `issues` are the problems found in the content. On an admin route each carries its person's text (`text`, and `where` when it has a place) next to
 *   its `code` and positions (`path`, `position`), which the editor uses to go to the problem.
 * - `details` is machine-readable extra data (the places a key is used, the server version of a `conflict`).
 */
export interface ErrorBody {
	readonly error: {
		readonly code: ErrorCode;
		readonly message: string;
		readonly fix?: string;
		readonly detail?: string;
		readonly issues?: readonly unknown[];
		readonly details?: unknown;
	};
}

export interface ErrorExtra {
	readonly fix?: string;
	readonly detail?: string;
	readonly issues?: readonly unknown[];
	readonly details?: unknown;
	readonly headers?: HeadersInit;
}

/** The response for a code. Nothing outside this file picks a status: it comes from {@link ERROR_STATUS}. */
export function errorResponse(code: ErrorCode, message: string, extra: ErrorExtra = {}): Response {
	const body: ErrorBody = {
		error: {
			code,
			message,
			...(extra.fix ? { fix: extra.fix } : {}),
			...(extra.detail && extra.detail !== message ? { detail: extra.detail } : {}),
			...(extra.issues && extra.issues.length > 0 ? { issues: extra.issues } : {}),
			...(extra.details !== undefined ? { details: extra.details } : {}),
		},
	};
	return Response.json(body, { status: ERROR_STATUS[code], ...(extra.headers ? { headers: extra.headers } : {}) });
}

/** A successful answer with a body. */
export const ok = (body: unknown, init?: ResponseInit): Response => Response.json(body, init);

/** The one answer to a delete: 204, no body. */
export const deleted = (): Response => new Response(null, { status: 204 });

/** A DB connection failure is a transient error (503). It is not disguised as missing content or an empty list. */
const isUnavailable = (error: unknown) => {
	const code = (error as { code?: unknown })?.code;
	return (
		typeof code === "string" &&
		(code === "ECONNREFUSED" ||
			code === "ETIMEDOUT" ||
			code === "ENOTFOUND" ||
			code === "57P01" ||
			code.startsWith("08"))
	);
};

/** The details of a store error: the version the server holds (for a `conflict`) next to what the store attached. */
function detailsOf(error: CmsError): unknown {
	if (error.serverVersion === undefined) return error.details;
	const attached = error.details && typeof error.details === "object" ? error.details : {};
	return { ...attached, serverVersion: error.serverVersion };
}

/** The issues of an error answer with their person's text (an issue that is not an object goes out as it is). */
const toldIssues = (site: Pick<Site, "createTranslator">, issues: readonly unknown[] | undefined) =>
	issues?.map((issue) =>
		issue && typeof issue === "object" ? { ...issue, ...issueText(site, issue as IssueLike) } : issue,
	);

/**
 * The person's text of a {@link CmsError} in the admin language, for an answer that is not an HTTP error (a line of a stream, one failed item of a batch):
 * the error's own `notice`, else the text of its code, with the developer text as `detail`.
 */
export function cmsErrorText(
	site: Pick<Site, "createTranslator">,
	error: CmsError,
): { readonly message: string; readonly fix?: string; readonly detail?: string } {
	const text = error.notice ?? codeNotice(site, error.code);
	const detail = HIDDEN_MESSAGE_CODES.has(error.code) || error.message === text.what ? undefined : error.message;
	return { message: text.what, ...(text.fix ? { fix: text.fix } : {}), ...(detail ? { detail } : {}) };
}

/**
 * The one answer to an error. With the `site` (an admin route), `message` and `fix` are the person's text in the admin language: the error's own `notice`,
 * else the text of its code; the error's `message` goes out as `detail`, and each issue gets its text ({@link issueText}). Without it (a public or machine route), `message` is the developer text as it is.
 */
export function handleApiError(error: unknown, site?: Pick<Site, "createTranslator">): Response {
	const told = (
		code: ErrorCode,
		notice: ErrorNotice | undefined,
		detail: string | undefined,
		extra: ErrorExtra = {},
	) => {
		if (!site) return errorResponse(code, detail ?? notice?.what ?? code, extra);
		const text = notice ?? codeNotice(site, code);
		return errorResponse(code, text.what, { ...extra, issues: toldIssues(site, extra.issues), fix: text.fix, detail });
	};

	// A setup mistake (a database that is down or not migrated, a missing setting): the server log has the fix; the response does not repeat host names.
	if (error instanceof SetupError) {
		console.error(`Monti is not set up correctly: ${error.message}`);
		return told(
			error.kind,
			undefined,
			site ? undefined : "The server is not set up correctly. The server log says how to fix it.",
		);
	}

	if (error instanceof AuthError) return told(error.code, undefined, error.message);

	if (error instanceof CmsError) {
		const hidden = HIDDEN_MESSAGE_CODES.has(error.code);
		if (hidden) console.error("CMS store invariant broken:", error);
		return told(error.code, error.notice, hidden ? (site ? undefined : "Internal server error") : error.message, {
			issues: error.issues,
			details: detailsOf(error),
		});
	}

	// The UI withdrew the request (e.g. reloading the model list). Nobody is waiting, so end quietly.
	if (isClientAbort(error)) return new Response(null, { status: 499 });

	if (isUnavailable(error)) {
		console.error("CMS storage unavailable:", error);
		return told("unavailable", undefined, site ? undefined : "Storage is temporarily unavailable");
	}

	console.error("Unhandled API error:", error);
	return told("internal_error", undefined, site ? undefined : "Internal server error");
}

/** Work stopped because the browser dropped the request (body not fully read) or the request signal aborted. */
function isClientAbort(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	// DOMException does not extend Error in every runtime. Check by name.
	const { name, code, message } = error as { name?: unknown; code?: unknown; message?: unknown };
	return name === "AbortError" || (code === "ECONNRESET" && message === "aborted");
}
