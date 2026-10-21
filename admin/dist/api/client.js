import { adminApiUrl } from "@monti-cms/core/site";
import { isSandboxSite, isWrite } from "../screens/shared/preview-sandbox.js";
import { cmsApiErrorMessage, cmsApiIssues } from "./error-message.js";
import { apiErrorMessages } from "./error-message.messages.js";
/**
 * Admin API error. The screen shows `message` (and `fix`) as they are, and branches on `status` and `code`. Both are already in the admin language:
 * the server writes them. `detail` is the developer text underneath, for a "details" view only.
 */
export class CmsApiError extends Error {
    status;
    code;
    issues;
    body;
    constructor(status, code, message, issues, 
    /** The `error` object of the answer: `code`, `message`, and `fix` / `detail` / `issues` / `details` when there are any. */
    body) {
        super(message);
        this.status = status;
        this.code = code;
        this.issues = issues;
        this.body = body;
        this.name = "CmsApiError";
    }
    /** What to do about it, when the server said. */
    get fix() {
        return typeof this.body.fix === "string" && this.body.fix ? this.body.fix : undefined;
    }
    /** The developer text underneath (a library's or another service's own words). Never the only text shown. */
    get detail() {
        return typeof this.body.detail === "string" && this.body.detail ? this.body.detail : undefined;
    }
}
/**
 * An error the screen code throws with text already written for the person (a file that is too large, a preview that cannot save).
 * Throw this, not a plain `Error`, when the text should be shown: the words of any other error are only kept as `detail`.
 */
export class NoticeError extends Error {
    fix;
    constructor(message, fix) {
        super(message);
        this.fix = fix;
        this.name = "NoticeError";
    }
}
/** The error of a failed answer, from its status and JSON body (`{ error: { code, message, fix?, detail?, issues? } }`). */
export function apiErrorOf(site, status, payload, fallback) {
    const body = (payload ?? {});
    const error = (typeof body.error === "object" && body.error !== null ? body.error : {});
    return new CmsApiError(status, typeof error.code === "string" ? error.code : undefined, cmsApiErrorMessage(site, error, fallback), cmsApiIssues(error), error);
}
/**
 * Calls the admin API at `path`, the part after `/api/monti` (`"/v1/entries?page=2"`; the site's `basePath` is added). Passing `json` sends a JSON body.
 * A failed response is thrown as {@link CmsApiError}, with its message in the admin language of `site`. A site that is a preview's refuses to write.
 * A network error rethrows the original `TypeError` so callers can tell it apart from being offline. In a component, `useAdminFetch()` gives the site.
 */
export async function adminFetch(site, path, init = {}) {
    const { json, form, fallback = site.createTranslator(apiErrorMessages)("fallback"), headers, ...rest } = init;
    // A preview runs on a draft site and must not write.
    if (isSandboxSite(site) && isWrite(rest.method)) {
        throw new CmsApiError(0, "preview", site.createTranslator(apiErrorMessages)("previewNoWrite"), [], {});
    }
    const response = await fetch(adminApiUrl(path), {
        ...rest,
        headers: json === undefined ? headers : { "Content-Type": "application/json", ...headers },
        body: form ?? (json === undefined ? undefined : JSON.stringify(json)),
    });
    if (response.status === 204)
        return undefined;
    const body = (await response.json().catch(() => ({})));
    if (!response.ok)
        throw apiErrorOf(site, response.status, body, fallback);
    return body;
}
/** Whether the server refused a write because the record changed since it was read (HTTP 409 `conflict`). */
export const isConflict = (error) => error instanceof CmsApiError && error.status === 409 && error.code === "conflict";
/**
 * The one place an error becomes what the user is told. An API error tells what the server wrote (its `message` already lists the `issues` it found),
 * a network error tells the offline text, and anything else tells `fallback`: the words of a thrown `Error` are never shown, only kept as `detail`.
 */
export function errorNotice(site, error, fallback) {
    if (error instanceof CmsApiError) {
        // With issues, the message lists them; a fix of the code alone would not fit each.
        return {
            message: error.message || fallback,
            fix: error.issues.length > 0 ? undefined : error.fix,
            detail: error.detail,
        };
    }
    if (error instanceof NoticeError)
        return { message: error.message || fallback, fix: error.fix };
    if (error instanceof TypeError)
        return { message: site.createTranslator(apiErrorMessages)("network") };
    return { message: fallback, detail: error instanceof Error && error.message ? error.message : undefined };
}
/** {@link errorNotice} as one line of text, for a toast or a short field error: what went wrong, then what to do. */
export const errorText = (site, error, fallback) => {
    const { message, fix } = errorNotice(site, error, fallback);
    return fix ? `${message} ${fix}` : message;
};
