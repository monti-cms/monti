import { type Site } from "@monti-cms/core/site";
import { type CmsIssue } from "./error-message.js";
/**
 * Admin API error. The screen shows `message` (and `fix`) as they are, and branches on `status` and `code`. Both are already in the admin language:
 * the server writes them. `detail` is the developer text underneath, for a "details" view only.
 */
export declare class CmsApiError extends Error {
    readonly status: number;
    readonly code: string | undefined;
    readonly issues: CmsIssue[];
    /** The `error` object of the answer: `code`, `message`, and `fix` / `detail` / `issues` / `details` when there are any. */
    readonly body: Record<string, unknown>;
    constructor(status: number, code: string | undefined, message: string, issues: CmsIssue[], 
    /** The `error` object of the answer: `code`, `message`, and `fix` / `detail` / `issues` / `details` when there are any. */
    body: Record<string, unknown>);
    /** What to do about it, when the server said. */
    get fix(): string | undefined;
    /** The developer text underneath (a library's or another service's own words). Never the only text shown. */
    get detail(): string | undefined;
}
/**
 * An error the screen code throws with text already written for the person (a file that is too large, a preview that cannot save).
 * Throw this, not a plain `Error`, when the text should be shown: the words of any other error are only kept as `detail`.
 */
export declare class NoticeError extends Error {
    readonly fix?: string | undefined;
    constructor(message: string, fix?: string | undefined);
}
/** The error of a failed answer, from its status and JSON body (`{ error: { code, message, fix?, detail?, issues? } }`). */
export declare function apiErrorOf(site: Pick<Site, "createTranslator">, status: number, payload: unknown, fallback: string): CmsApiError;
/**
 * What `adminFetch` takes besides the path: `fetch`'s options, `json` for a JSON body, `form` for a multipart upload (the browser sets its content type), and the
 * `fallback` message of a failure the server does not explain.
 */
export type AdminFetchInit = Omit<RequestInit, "body"> & {
    json?: unknown;
    form?: FormData;
    fallback?: string;
};
/**
 * Calls the admin API at `path`, the part after `/api/monti` (`"/v1/entries?page=2"`; the site's `basePath` is added). Passing `json` sends a JSON body.
 * A failed response is thrown as {@link CmsApiError}, with its message in the admin language of `site`. A site that is a preview's refuses to write.
 * A network error rethrows the original `TypeError` so callers can tell it apart from being offline. In a component, `useAdminFetch()` gives the site.
 */
export declare function adminFetch<T = unknown>(site: Pick<Site, "createTranslator">, path: string, init?: AdminFetchInit): Promise<T>;
/** Whether the server refused a write because the record changed since it was read (HTTP 409 `conflict`). */
export declare const isConflict: (error: unknown) => boolean;
/** What a person is told about an error: what went wrong, what to do (when known), and the developer text behind "details". */
export interface ErrorNotice {
    readonly message: string;
    readonly fix?: string;
    readonly detail?: string;
}
/**
 * The one place an error becomes what the user is told. An API error tells what the server wrote (its `message` already lists the `issues` it found),
 * a network error tells the offline text, and anything else tells `fallback`: the words of a thrown `Error` are never shown, only kept as `detail`.
 */
export declare function errorNotice(site: Pick<Site, "createTranslator">, error: unknown, fallback: string): ErrorNotice;
/** {@link errorNotice} as one line of text, for a toast or a short field error: what went wrong, then what to do. */
export declare const errorText: (site: Pick<Site, "createTranslator">, error: unknown, fallback: string) => string;
