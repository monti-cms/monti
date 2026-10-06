import { CmsApiError } from "../screens/admin-api";
import type { CmsIssue } from "../screens/api-error-message";

/**
 * Codes the editor hooks produce. Server codes pass through (`CmsApiError.code`), so the union stays open.
 *
 * @experimental
 */
export type EditorErrorCode =
	/** The caller cancelled. Never kept in hook state. */
	| "aborted"
	/** A network error (a fetch `TypeError`). */
	| "offline"
	/** HTTP 401. */
	| "session_expired"
	/** HTTP 409 `conflict`, or a version mismatch found before saving. */
	| "conflict"
	/** A 4xx response with issues, or a local check that failed. */
	| "validation"
	| "not_found"
	/** A trashed entry, a locked field, a non-editable editor. */
	| "read_only"
	/** A child count outside the definition's min/max. */
	| "limit"
	/** The command is not allowed right now (apply with no result, save while saving). */
	| "invalid_state"
	| "failed"
	| (string & {});

/**
 * A failed command or a failed async run.
 *
 * @experimental
 */
export interface EditorError {
	readonly code: EditorErrorCode;
	/** Text to show as is. Already localized (same contract as `CmsApiError.message`). Branch on `code`, never on this. */
	readonly message: string;
	readonly status?: number;
	/** Server issues, ready for `cmsIssueMessage`. */
	readonly issues?: readonly CmsIssue[];
	/** Whether the same call can succeed on a retry without the user changing anything. */
	readonly retryable: boolean;
	readonly cause?: unknown;
}

/**
 * What a command returns. Commands never throw for expected failures.
 *
 * @experimental
 */
export type EditorResult<T = void> =
	| { readonly ok: true; readonly value: T }
	| { readonly ok: false; readonly error: EditorError };

/** Builds a failed result. */
export function editorFailure(code: EditorErrorCode, message: string, retryable = false): EditorResult<never> {
	return { ok: false, error: { code, message, retryable } };
}

const isAbortError = (error: unknown) =>
	typeof error === "object" && error !== null && (error as { name?: unknown }).name === "AbortError";

/**
 * Turns what the admin code throws into an {@link EditorError}: `CmsApiError`, a fetch `TypeError`, an `AbortError` and any other error.
 * `fallback` is the localized text used when the source has none of its own.
 *
 * - 401 is `session_expired`, 409 with `code === "conflict"` is `conflict`, 404 is `not_found`, a 4xx response with issues is `validation`.
 *   Any other code the server sent passes through; without one it is `failed`. A status below 500 is not retryable, 5xx is.
 * - A fetch `TypeError` is `offline` and retryable. Its own message is the browser's and not localized, so `fallback` is used.
 * - An `AbortError` is `aborted`.
 * - Any other error is `failed` with its message (or `fallback` when empty). It is not marked retryable because the cause is unknown.
 *
 * @experimental
 */
export function toEditorError(error: unknown, fallback: string): EditorError {
	if (error instanceof CmsApiError) {
		const base = { message: error.message || fallback, status: error.status, issues: error.issues, cause: error };
		if (error.status === 401) return { ...base, code: "session_expired", retryable: false };
		if (error.status === 409 && error.code === "conflict") return { ...base, code: "conflict", retryable: false };
		if (error.status === 404) return { ...base, code: "not_found", retryable: false };
		if (error.status < 500 && error.issues.length > 0) return { ...base, code: "validation", retryable: false };
		return { ...base, code: error.code ?? "failed", retryable: error.status >= 500 };
	}
	if (isAbortError(error)) return { code: "aborted", message: fallback, retryable: true, cause: error };
	if (error instanceof TypeError) return { code: "offline", message: fallback, retryable: true, cause: error };
	if (error instanceof Error)
		return { code: "failed", message: error.message || fallback, retryable: false, cause: error };
	return { code: "failed", message: fallback, retryable: false, cause: error };
}
