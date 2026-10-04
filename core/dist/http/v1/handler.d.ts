import type { NextRequest } from "next/server";
import type { z } from "zod";
import { type AuthContext } from "../../adapters/auth/index.js";
/**
 * Shared frame for admin API routes. Every admin request is authenticated on the server,
 * and state-changing requests go through the same-origin check first. Errors are converted to one shape in a single place.
 */
type Params = Record<string, string>;
type HandlerContext<P extends Params> = {
    params: Promise<P>;
};
export interface AdminRequest<P extends Params> {
    request: NextRequest;
    params: P;
    auth: AuthContext;
}
export declare function adminRoute<P extends Params = Params>(handler: (input: AdminRequest<P>) => Promise<Response>): (request: NextRequest, context?: HandlerContext<P>) => Promise<Response>;
/** Reads the JSON body. 400 if malformed. A missing body is treated as `{}`. */
export declare function readJsonBody(request: NextRequest): Promise<unknown>;
/**
 * Change requests need the `version` from the read response. 428 if missing, and the store throws 409 if it differs from the server.
 * A missing version is rejected before a malformed body (400).
 */
export declare function assertVersionPresent(value: unknown): void;
export declare function parseWith<S extends z.ZodType>(schema: S, value: unknown, message?: string): z.output<S>;
/** Reads the body, checks that a version is present, then validates it against the schema. */
export declare function readVersionedBody<S extends z.ZodType>(request: NextRequest, schema: S): Promise<z.output<S>>;
/** The `expectedVersion` query param (DELETE requests). */
export declare function readVersionQuery(request: NextRequest): number;
/** Converts the query to an object. Keys in `arrayKeys` may appear multiple times. */
export declare function readQuery(request: NextRequest, arrayKeys?: readonly string[]): Record<string, unknown>;
export declare const json: (body: unknown, init?: ResponseInit) => Response;
export {};
