import { AuthError } from "../../adapters/auth/index.js";
import { ERROR_STATUS, HIDDEN_MESSAGE_CODES } from "../../core/error-codes.js";
import { noticeText } from "../../core/error-notice.js";
import { issueText } from "../../core/issue-text.js";
import { SetupError } from "../../core/problem.js";
import { CmsError } from "../../core/store/errors.js";
export { CmsError, ERROR_STATUS };
/** The response for a code. Nothing outside this file picks a status: it comes from {@link ERROR_STATUS}. */
export function errorResponse(code, message, extra = {}) {
    const body = {
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
/** The issues of an error answer with their person's text (an issue that is not an object goes out as it is). */
const toldIssues = (site, issues) => issues?.map((issue) => issue && typeof issue === "object" ? { ...issue, ...issueText(site, issue) } : issue);
/**
 * The person's text of a {@link CmsError} in the admin language, for an answer that is not an HTTP error (a line of a stream, one failed item of a batch):
 * the error's own `notice` (read from the core notice dictionary when it is a key), else the text of its code, with the developer text as `detail`.
 */
export function cmsErrorText(site, error) {
    const text = noticeText(site, error);
    const detail = HIDDEN_MESSAGE_CODES.has(error.code) || error.message === text.what ? undefined : error.message;
    return { message: text.what, ...(text.fix ? { fix: text.fix } : {}), ...(detail ? { detail } : {}) };
}
/**
 * The one answer to an error. With the `site` (an admin route), `message` and `fix` are the person's text in the admin language: the error's own `notice`,
 * else the text of its code; the error's `message` goes out as `detail`, and each issue gets its text ({@link issueText}). Without it (a public or machine route), `message` is the developer text as it is.
 */
export function handleApiError(error, site) {
    const told = (code, notice, detail, extra = {}) => {
        if (!site)
            return errorResponse(code, detail ?? (notice && "what" in notice ? notice.what : code), extra);
        const text = noticeText(site, { code, notice });
        return errorResponse(code, text.what, { ...extra, issues: toldIssues(site, extra.issues), fix: text.fix, detail });
    };
    // A setup mistake (a database that is down or not migrated, a missing setting): the server log has the fix; the response does not repeat host names.
    if (error instanceof SetupError) {
        console.error(`Monti is not set up correctly: ${error.message}`);
        return told(error.kind, undefined, site ? undefined : "The server is not set up correctly. The server log says how to fix it.");
    }
    if (error instanceof AuthError)
        return told(error.code, undefined, error.message);
    if (error instanceof CmsError) {
        const hidden = HIDDEN_MESSAGE_CODES.has(error.code);
        if (hidden)
            console.error("CMS store invariant broken:", error);
        return told(error.code, error.notice, hidden ? (site ? undefined : "Internal server error") : error.message, {
            issues: error.issues,
            details: detailsOf(error),
        });
    }
    // The UI withdrew the request (e.g. reloading the model list). Nobody is waiting, so end quietly.
    if (isClientAbort(error))
        return new Response(null, { status: 499 });
    if (isUnavailable(error)) {
        console.error("CMS storage unavailable:", error);
        return told("unavailable", undefined, site ? undefined : "Storage is temporarily unavailable");
    }
    console.error("Unhandled API error:", error);
    return told("internal_error", undefined, site ? undefined : "Internal server error");
}
/** Work stopped because the browser dropped the request (body not fully read) or the request signal aborted. */
function isClientAbort(error) {
    if (!error || typeof error !== "object")
        return false;
    // DOMException does not extend Error in every runtime. Check by name.
    const { name, code, message } = error;
    return name === "AbortError" || (code === "ECONNRESET" && message === "aborted");
}
