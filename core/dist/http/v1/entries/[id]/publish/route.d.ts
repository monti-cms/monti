/**
 * Explicit publish. The store re-validates for publishing inside the transaction and, on failure, returns 422 with located `issues`.
 * The publish date is the first publish time, and `resetPublishedAt` resets it to now. Image resolution problems are reported only as non-blocking `warnings`.
 */
export declare const POST: (request: import("next/server").NextRequest, context?: {
    params: Promise<{
        id: string;
    }>;
} | undefined) => Promise<Response>;
