import { CmsApiError } from "../screens/admin-api.js";
/** Builds a failed result. */
export function editorFailure(code, message, retryable = false) {
    return { ok: false, error: { code, message, retryable } };
}
const isAbortError = (error) => typeof error === "object" && error !== null && error.name === "AbortError";
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
export function toEditorError(error, fallback) {
    if (error instanceof CmsApiError) {
        const base = { message: error.message || fallback, status: error.status, issues: error.issues, cause: error };
        if (error.status === 401)
            return { ...base, code: "session_expired", retryable: false };
        if (error.status === 409 && error.code === "conflict")
            return { ...base, code: "conflict", retryable: false };
        if (error.status === 404)
            return { ...base, code: "not_found", retryable: false };
        if (error.status < 500 && error.issues.length > 0)
            return { ...base, code: "validation", retryable: false };
        return { ...base, code: error.code ?? "failed", retryable: error.status >= 500 };
    }
    if (isAbortError(error))
        return { code: "aborted", message: fallback, retryable: true, cause: error };
    if (error instanceof TypeError)
        return { code: "offline", message: fallback, retryable: true, cause: error };
    if (error instanceof Error)
        return { code: "failed", message: error.message || fallback, retryable: false, cause: error };
    return { code: "failed", message: fallback, retryable: false, cause: error };
}
