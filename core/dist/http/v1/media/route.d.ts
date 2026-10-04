/** Media library: filename search, filters by type, upload date, and usage, newest upload first. */
export declare const GET: (request: import("next/server").NextRequest, context?: {
    params: Promise<{
        [x: string]: string;
    }>;
} | undefined) => Promise<Response>;
