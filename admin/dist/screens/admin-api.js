import { createTranslator } from "@monti-cms/core/client";
import { cmsApiErrorMessage, cmsApiIssues } from "./api-error-message.js";
import { screensMessages } from "./messages.js";
const t = createTranslator(screensMessages);
/** Admin API error. The screen shows `message` as is and branches on `status` and `code`. */
export class CmsApiError extends Error {
    status;
    code;
    issues;
    body;
    constructor(status, code, message, issues, body) {
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
export async function cmsFetch(url, init = {}) {
    const { json, fallback = t("api.fallback"), headers, ...rest } = init;
    const response = await fetch(url, {
        ...rest,
        headers: json === undefined ? headers : { "Content-Type": "application/json", ...headers },
        body: json === undefined ? undefined : JSON.stringify(json),
    });
    if (response.status === 204)
        return undefined;
    const body = (await response.json().catch(() => ({})));
    if (!response.ok) {
        throw new CmsApiError(response.status, typeof body.code === "string" ? body.code : undefined, cmsApiErrorMessage(body, fallback), cmsApiIssues(body), body);
    }
    return body;
}
export const errorText = (error, fallback) => error instanceof CmsApiError ? error.message : error instanceof TypeError ? t("api.network") : fallback;
