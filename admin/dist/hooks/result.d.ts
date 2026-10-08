import type { CmsIssue } from "../screens/api-error-message.js";
/**
 * Codes the editor hooks produce. Server codes pass through (`CmsApiError.code`), so the union stays open.
 *
 * @experimental
 */
export type EditorErrorCode = 
/** The caller cancelled. Never kept in hook state. */
"aborted"
/** A network error (a fetch `TypeError`). */
 | "offline"
/** HTTP 401. */
 | "session_expired"
/** HTTP 409 `conflict`, or a version mismatch found before saving. */
 | "conflict"
/** A 4xx response with issues, or a local check that failed. */
 | "validation" | "not_found"
/** A trashed entry, a locked field, a non-editable editor. */
 | "read_only"
/** A child count outside the definition's min/max. */
 | "limit"
/** The command is not allowed right now (apply with no result, save while saving). */
 | "invalid_state" | "failed" | (string & {});
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
export type EditorResult<T = void> = {
    readonly ok: true;
    readonly value: T;
} | {
    readonly ok: false;
    readonly error: EditorError;
};
/** Builds a failed result. */
export declare function editorFailure(code: EditorErrorCode, message: string, retryable?: boolean): EditorResult<never>;
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
export declare function toEditorError(error: unknown, fallback: string): EditorError;
