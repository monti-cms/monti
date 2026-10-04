type IdParams = {
    id: string;
};
/** Edits a connection. If the key is omitted, the stored key is kept (deleted if the address changed); `null` deletes it. */
export declare const PATCH: (request: import("next/server").NextRequest, context?: {
    params: Promise<IdParams>;
} | undefined) => Promise<Response>;
/** Deletes a connection. Actions that chose it fall back to the first connection suited to their kind. */
export declare const DELETE: (request: import("next/server").NextRequest, context?: {
    params: Promise<IdParams>;
} | undefined) => Promise<Response>;
export {};
