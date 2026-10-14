import { ERROR_STATUS, type ErrorCode } from "../../core/error-codes.js";
import { CmsError } from "../../core/store/errors.js";
export { CmsError, ERROR_STATUS, type ErrorCode };
/**
 * The error body of every answer: `{ error: { code, message, issues?, details? } }`. `details` is machine-readable extra data
 * (the places a key is used, the server version of a `conflict`); `issues` are the problems found in the content.
 */
export interface ErrorBody {
    readonly error: {
        readonly code: ErrorCode;
        readonly message: string;
        readonly issues?: readonly unknown[];
        readonly details?: unknown;
    };
}
/** The response for a code. Nothing outside this file picks a status: it comes from {@link ERROR_STATUS}. */
export declare function errorResponse(code: ErrorCode, message: string, extra?: {
    readonly issues?: readonly unknown[];
    readonly details?: unknown;
    readonly headers?: HeadersInit;
}): Response;
/** A successful answer with a body. */
export declare const ok: (body: unknown, init?: ResponseInit) => Response;
/** The one answer to a delete: 204, no body. */
export declare const deleted: () => Response;
export declare function handleApiError(error: unknown): Response;
