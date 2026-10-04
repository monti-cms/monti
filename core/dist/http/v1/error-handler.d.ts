import { NextResponse } from "next/server";
/**
 * HTTP errors that routes throw directly (malformed request, missing version, etc.). Plugin errors extend this to set the status code.
 * The response shape matches other errors: `code`, `message`, and `issues` when present.
 */
export declare class HttpError extends Error {
    readonly status: number;
    readonly code: string;
    readonly issues?: unknown;
    constructor(status: number, code: string, message: string, issues?: unknown);
}
export declare function handleApiError(error: unknown): NextResponse;
