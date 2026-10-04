/** Trash → restore. Record collections are validated and returned to the active record. */
export declare const POST: (request: import("next/server").NextRequest, context?: {
    params: Promise<{
        id: string;
    }>;
} | undefined) => Promise<Response>;
