import type { NextRequest } from "next/server";
/** Admin export. GET is also open so it can be downloaded via a link. */
export declare const GET: (request: NextRequest, context?: {
    params: Promise<{
        [x: string]: string;
    }>;
} | undefined) => Promise<Response>;
export declare const POST: (request: NextRequest, context?: {
    params: Promise<{
        [x: string]: string;
    }>;
} | undefined) => Promise<Response>;
