import type { ErrorCode } from "../error-codes.js";
/**
 * The one error the server code throws for a request it cannot do. `code` is an {@link ErrorCode}, so the HTTP status comes from one table and
 * the response has one shape: `{ error: { code, message, issues?, details? } }`.
 */
export declare class CmsError extends Error {
    readonly code: ErrorCode;
    /** The version the server holds, for a `conflict`: the caller can reload and retry. It reaches the response as `details.serverVersion`. */
    readonly serverVersion?: number;
    readonly details?: unknown;
    /** Problems found in the request (the issues of a validation), when the code is about the content. */
    readonly issues?: readonly unknown[];
    constructor(message: string, code: ErrorCode, serverVersion?: number, details?: unknown, issues?: readonly unknown[]);
}
