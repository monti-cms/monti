import { isSandboxSite, isWrite } from "../screens/shared/preview-sandbox.js";
import { cmsApiErrorMessage, cmsApiIssues } from "./error-message.js";
import { apiErrorMessages } from "./error-message.messages.js";
/** Admin API error. The screen shows `message` as is and branches on `status` and `code`. */
export class CmsApiError extends Error {
    status;
    code;
    issues;
    body;
    constructor(status, code, message, issues, 
    /** The `error` object of the answer: `code`, `message`, and `issues` / `details` when there are any. */
    body) {
        super(message);
        this.status = status;
        this.code = code;
        this.issues = issues;
        this.body = body;
        this.name = "CmsApiError";
    }
}
/**
 * Calls the admin API (the URL is built with `cmsApiUrl()`). Passing `json` sends a JSON body. A failed response is thrown as {@link CmsApiError}.
 * A network error rethrows the original `TypeError` so callers can tell it apart from being offline.
 */
export async function cmsFetch(site, url, init = {}) {
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
    if (response.status === 204)
        return undefined;
    const body = (await response.json().catch(() => ({})));
    if (!response.ok) {
        // Every error answer is `{ error: { code, message, issues?, details? } }`.
        const error = (typeof body.error === "object" && body.error !== null ? body.error : {});
        throw new CmsApiError(response.status, typeof error.code === "string" ? error.code : undefined, cmsApiErrorMessage(site, error, fallback), cmsApiIssues(error), error);
    }
    return body;
}
/** Whether the server refused a write because the record changed since it was read (HTTP 409 `conflict`). */
export const isConflict = (error) => error instanceof CmsApiError && error.status === 409 && error.code === "conflict";
/**
 * The one place an error becomes text for the user. An API error shows its own message (which already lists the `issues` the server found),
 * a network error shows the offline text, and anything else shows `fallback`.
 */
export const errorText = (site, error, fallback) => error instanceof CmsApiError
    ? error.message || fallback
    : error instanceof TypeError
        ? site.createTranslator(apiErrorMessages)("network")
        : fallback;
