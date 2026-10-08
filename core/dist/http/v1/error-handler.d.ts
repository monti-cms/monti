/**
 * HTTP errors that routes throw directly (malformed request, missing version, etc.). Plugin errors extend this to set the status code.
 * The response shape matches other errors: `code`, `message`, and `issues` when present.
 */
export declare class HttpError extends Error {
    readonly status: number;
    readonly code: string;
    readonly issues?: unknown;
    /** More members of the response body (a machine-readable `reason`, say). */
    readonly extra?: Readonly<Record<string, unknown>> | undefined;
    constructor(status: number, code: string, message: string, issues?: unknown, 
    /** More members of the response body (a machine-readable `reason`, say). */
    extra?: Readonly<Record<string, unknown>> | undefined);
}
export declare function handleApiError(error: unknown): Response;
