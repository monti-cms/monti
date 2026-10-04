/** Draft/published → archived. Ends publication. */
export declare const POST: (request: import("next/server").NextRequest, context?: {
    params: Promise<{
        id: string;
    }>;
} | undefined) => Promise<Response>;
