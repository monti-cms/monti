type IdParams = {
    id: string;
};
export declare const GET: (request: import("next/server").NextRequest, context?: {
    params: Promise<IdParams>;
} | undefined) => Promise<Response>;
export declare const PATCH: (request: import("next/server").NextRequest, context?: {
    params: Promise<IdParams>;
} | undefined) => Promise<Response>;
export declare const DELETE: (request: import("next/server").NextRequest, context?: {
    params: Promise<IdParams>;
} | undefined) => Promise<Response>;
export {};
