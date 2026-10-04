import { type CmsIssue } from "./api-error-message.js";
/** Admin API error. The screen shows `message` as is and branches on `status` and `code`. */
export declare class CmsApiError extends Error {
    readonly status: number;
    readonly code: string | undefined;
    readonly issues: CmsIssue[];
    readonly body: Record<string, unknown>;
    constructor(status: number, code: string | undefined, message: string, issues: CmsIssue[], body: Record<string, unknown>);
}
/**
 * Calls the admin API (the URL is built with `cmsApiUrl()`). Passing `json` sends a JSON body. A failed response is thrown as {@link CmsApiError}.
 * A network error rethrows the original `TypeError` so callers can tell it apart from being offline.
 */
export declare function cmsFetch<T = unknown>(url: string, init?: Omit<RequestInit, "body"> & {
    json?: unknown;
    fallback?: string;
}): Promise<T>;
export declare const errorText: (error: unknown, fallback: string) => string;
