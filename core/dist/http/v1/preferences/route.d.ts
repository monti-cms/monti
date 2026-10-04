export declare const GET: (request: import("next/server").NextRequest, context?: {
    params: Promise<{
        [x: string]: string;
    }>;
} | undefined) => Promise<Response>;
/** Merges and saves per collection. Collections and keys not sent are kept. */
export declare const PUT: (request: import("next/server").NextRequest, context?: {
    params: Promise<{
        [x: string]: string;
    }>;
} | undefined) => Promise<Response>;
