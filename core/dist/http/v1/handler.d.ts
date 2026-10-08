import type { z } from "zod";
import type { AuthContext } from "../../adapters/auth/index.js";
import type { Cms } from "../../cms/index.js";
/**
 * Shared frame for admin API routes. Every admin request is authenticated on the server,
 * and state-changing requests go through the same-origin check first. Errors are converted to one shape in a single place.
 *
 * The request handler (`cms.handle()`, which a host package such as `@monti-cms/nextjs` mounts) passes the CMS instance in the context of every route (`{ params, cms }`), so a route reads
 * stores and settings from `cms` instead of from module-level state.
 */
type Params = Record<string, string>;
/** What the route handler passes to a route: the path params and the CMS instance the request is served by. */
export type RouteContext<P extends Params = Params> = {
    params?: Promise<P>;
    cms: Cms;
};
export interface AdminRequest<P extends Params> {
    request: Request;
    params: P;
    auth: AuthContext;
    cms: Cms;
}
/**
 * Wraps a route with the admin check. The route handler passes the instance in the context. A route file mounted on its own in the app
 * (not served by `cms.handle()`) names the instance it belongs to with `bound.cms`.
 */
export declare function adminRoute<P extends Params = Params>(handler: (input: AdminRequest<P>) => Promise<Response>, bound?: {
    readonly cms?: Cms;
}): (request: Request, context?: Partial<RouteContext<P>>) => Promise<Response>;
/** Reads the JSON body. 400 if malformed. A missing body is treated as `{}`. */
export declare function readJsonBody(request: Request): Promise<unknown>;
/**
 * Change requests need the `version` from the read response. 428 if missing, and the store throws 409 if it differs from the server.
 * A missing version is rejected before a malformed body (400).
 */
export declare function assertVersionPresent(value: unknown): void;
export declare function parseWith<S extends z.ZodType>(schema: S, value: unknown, message?: string): z.output<S>;
/** Reads the body, checks that a version is present, then validates it against the schema. */
export declare function readVersionedBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>>;
/** The `expectedVersion` query param (DELETE requests). */
export declare function readVersionQuery(request: Request): number;
/** Converts the query to an object. Keys in `arrayKeys` may appear multiple times. */
export declare function readQuery(request: Request, arrayKeys?: readonly string[]): Record<string, unknown>;
/** The `format` query param of a read, or `undefined`. An invalid name is a 400; whether the format is installed is decided where it is used. */
export declare function readFormatQuery(request: Request): string | undefined;
export declare const json: (body: unknown, init?: ResponseInit) => Response;
export {};
