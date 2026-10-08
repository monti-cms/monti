/** Stable error thrown by store implementations. The HTTP layer maps `code` to a status code. */
export declare class CmsError extends Error {
    readonly code: string;
    readonly serverVersion?: number;
    readonly details?: unknown;
    constructor(message: string, code: string, serverVersion?: number, details?: unknown);
}
