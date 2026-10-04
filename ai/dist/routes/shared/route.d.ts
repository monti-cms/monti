import type { NextRequest } from "next/server";
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
export declare const PATCH: (request: NextRequest, context?: {
    params: Promise<{
        [x: string]: string;
    }>;
} | undefined) => Promise<Response>;
export declare const PUT: (request: NextRequest, context?: {
    params: Promise<{
        [x: string]: string;
    }>;
} | undefined) => Promise<Response>;
export declare const DELETE: (request: NextRequest, context?: {
    params: Promise<{
        [x: string]: string;
    }>;
} | undefined) => Promise<Response>;
