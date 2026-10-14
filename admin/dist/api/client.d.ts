import type { Site } from "@monti-cms/core/client";
import { type CmsIssue } from "./error-message.js";
/** Admin API error. The screen shows `message` as is and branches on `status` and `code`. */
export declare class CmsApiError extends Error {
    readonly status: number;
    readonly code: string | undefined;
    readonly issues: CmsIssue[];
    /** The `error` object of the answer: `code`, `message`, and `issues` / `details` when there are any. */
    readonly body: Record<string, unknown>;
    constructor(status: number, code: string | undefined, message: string, issues: CmsIssue[], 
    /** The `error` object of the answer: `code`, `message`, and `issues` / `details` when there are any. */
    body: Record<string, unknown>);
}
/**
 * Calls the admin API (the URL is built with `cmsApiUrl()`). Passing `json` sends a JSON body. A failed response is thrown as {@link CmsApiError}.
 * A network error rethrows the original `TypeError` so callers can tell it apart from being offline.
 */
export declare function cmsFetch<T = unknown>(site: Pick<Site, "createTranslator">, url: string, init?: Omit<RequestInit, "body"> & {
    json?: unknown;
    fallback?: string;
}): Promise<T>;
/** Whether the server refused a write because the record changed since it was read (HTTP 409 `conflict`). */
export declare const isConflict: (error: unknown) => boolean;
/**
 * The one place an error becomes text for the user. An API error shows its own message (which already lists the `issues` the server found),
 * a network error shows the offline text, and anything else shows `fallback`.
 */
export declare const errorText: (site: Pick<Site, "createTranslator">, error: unknown, fallback: string) => string;
