import { ERROR_STATUS, type ErrorCode } from "../../core/error-codes.js";
import { CmsError, type ErrorNotice, type NoticeRef } from "../../core/store/errors.js";
import type { Site } from "../../site/index.js";
export { CmsError, ERROR_STATUS, type ErrorCode, type ErrorNotice, type NoticeRef };
/**
 * The error body of every answer: `{ error: { code, message, fix?, detail?, issues?, details? } }`.
 * - `message` and `fix` are for a person: what went wrong and what to do, in the admin language on an admin route.
 * - `detail` is the developer text (a library's or another service's own words), for a "details" view and bug reports. It is never the only text shown.
 * - `issues` are the problems found in the content. On an admin route each carries its person's text (`text`, and `where` when it has a place) next to
 *   its `code` and positions (`path`, `position`), which the editor uses to go to the problem.
 * - `details` is machine-readable extra data (the places a key is used, the server version of a `conflict`).
 */
export interface ErrorBody {
    readonly error: {
        readonly code: ErrorCode;
        readonly message: string;
        readonly fix?: string;
        readonly detail?: string;
        readonly issues?: readonly unknown[];
        readonly details?: unknown;
    };
}
export interface ErrorExtra {
    readonly fix?: string;
    readonly detail?: string;
    readonly issues?: readonly unknown[];
    readonly details?: unknown;
    readonly headers?: HeadersInit;
}
/** The response for a code. Nothing outside this file picks a status: it comes from {@link ERROR_STATUS}. */
export declare function errorResponse(code: ErrorCode, message: string, extra?: ErrorExtra): Response;
/** A successful answer with a body. */
export declare const ok: (body: unknown, init?: ResponseInit) => Response;
/** The one answer to a delete: 204, no body. */
export declare const deleted: () => Response;
/**
 * The person's text of a {@link CmsError} in the admin language, for an answer that is not an HTTP error (a line of a stream, one failed item of a batch):
 * the error's own `notice` (read from the core notice dictionary when it is a key), else the text of its code, with the developer text as `detail`.
 */
export declare function cmsErrorText(site: Pick<Site, "createTranslator">, error: CmsError): {
    readonly message: string;
    readonly fix?: string;
    readonly detail?: string;
};
/**
 * The one answer to an error. With the `site` (an admin route), `message` and `fix` are the person's text in the admin language: the error's own `notice`,
 * else the text of its code; the error's `message` goes out as `detail`, and each issue gets its text ({@link issueText}). Without it (a public or machine route), `message` is the developer text as it is.
 */
export declare function handleApiError(error: unknown, site?: Pick<Site, "createTranslator">): Response;
