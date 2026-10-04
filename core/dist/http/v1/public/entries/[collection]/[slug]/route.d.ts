import type { NextRequest } from "next/server";
export declare const GET: (request: NextRequest, context?: {
    params: Promise<{
        collection: string;
        slug: string;
    }>;
}) => Promise<Response>;
