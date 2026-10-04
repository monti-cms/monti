/** Folder tree per collection. */
export declare const GET: (request: import("next/server").NextRequest, context?: {
    params: Promise<{
        [x: string]: string;
    }>;
} | undefined) => Promise<Response>;
export declare const POST: (request: import("next/server").NextRequest, context?: {
    params: Promise<{
        [x: string]: string;
    }>;
} | undefined) => Promise<Response>;
