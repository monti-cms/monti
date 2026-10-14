import { AuthError } from "../../adapters/auth/index.js";
import { ERROR_STATUS, HIDDEN_MESSAGE_CODES } from "../../core/error-codes.js";
import { SetupError } from "../../core/problem.js";
import { CmsError } from "../../core/store/errors.js";
export { CmsError, ERROR_STATUS };
/** The response for a code. Nothing outside this file picks a status: it comes from {@link ERROR_STATUS}. */
export function errorResponse(code, message, extra = {}) {
    const body = {
        error: {
            code,
            message,
            ...(extra.issues && extra.issues.length > 0 ? { issues: extra.issues } : {}),
            ...(extra.details !== undefined ? { details: extra.details } : {}),
        },
    };
    return Response.json(body, { status: ERROR_STATUS[code], ...(extra.headers ? { headers: extra.headers } : {}) });
}
/** A successful answer with a body. */
export const ok = (body, init) => Response.json(body, init);
/** The one answer to a delete: 204, no body. */
export const deleted = () => new Response(null, { status: 204 });
/** A DB connection failure is a transient error (503). It is not disguised as missing content or an empty list. */
const isUnavailable = (error) => {
    const code = error?.code;
    return (typeof code === "string" &&
        (code === "ECONNREFUSED" ||
            code === "ETIMEDOUT" ||
            code === "ENOTFOUND" ||
            code === "57P01" ||
            code.startsWith("08")));
};
/** The details of a store error: the version the server holds (for a `conflict`) next to what the store attached. */
function detailsOf(error) {
    if (error.serverVersion === undefined)
        return error.details;
    const attached = error.details && typeof error.details === "object" ? error.details : {};
    return { ...attached, serverVersion: error.serverVersion };
}
export function handleApiError(error) {
    // A setup mistake (a database that is down or not migrated, a missing setting): the server log has the fix; the response does not repeat host names.
    if (error instanceof SetupError) {
        console.error(`Monti is not set up correctly: ${error.message}`);
        return errorResponse(error.kind, "The server is not set up correctly. The server log says how to fix it.");
    }
    if (error instanceof AuthError)
        return errorResponse(error.code, error.message);
    if (error instanceof CmsError) {
        const hidden = HIDDEN_MESSAGE_CODES.has(error.code);
        if (hidden)
            console.error("CMS store invariant broken:", error);
        return errorResponse(error.code, hidden ? "Internal server error" : error.message, {
            issues: error.issues,
            details: detailsOf(error),
        });
    }
    // The UI withdrew the request (e.g. reloading the model list). Nobody is waiting, so end quietly.
    if (isClientAbort(error))
        return new Response(null, { status: 499 });
    if (isUnavailable(error)) {
        console.error("CMS storage unavailable:", error);
        return errorResponse("unavailable", "Storage is temporarily unavailable");
    }
    console.error("Unhandled API error:", error);
    return errorResponse("internal_error", "Internal server error");
}
/** Work stopped because the browser dropped the request (body not fully read) or the request signal aborted. */
function isClientAbort(error) {
    if (!error || typeof error !== "object")
        return false;
    // DOMException does not extend Error in every runtime. Check by name.
    const { name, code, message } = error;
    return name === "AbortError" || (code === "ECONNRESET" && message === "aborted");
}
