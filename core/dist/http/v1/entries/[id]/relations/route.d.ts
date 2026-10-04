/** Where this entry is used (back references). Distinguishes draft and published usages. */
export declare const GET: (request: import("next/server").NextRequest, context?: {
    params: Promise<{
        id: string;
    }>;
} | undefined) => Promise<Response>;
