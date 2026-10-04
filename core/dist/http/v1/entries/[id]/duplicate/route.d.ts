/** Duplicates the latest draft as a draft with a new ID. */
export declare const POST: (request: import("next/server").NextRequest, context?: {
    params: Promise<{
        id: string;
    }>;
} | undefined) => Promise<Response>;
