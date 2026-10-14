import type { z } from "zod";
import type { AuthContext } from "../../adapters/auth/index.js";
import type { Cms } from "../../cms/index.js";
import { deleted, ok } from "./error-handler.js";
/**
 * Shared frame for admin API routes. Every admin request is authenticated on the server,
 * and state-changing requests go through the same-origin check first. Errors are converted to one shape in a single place.
 *
 * The request handler (`cms.handle()`, which a host package such as `@monti-cms/nextjs` mounts) passes the CMS instance in the context of every route (`{ params, cms }`), so a route reads
 * stores and settings from `cms` instead of from module-level state.
 */
type Params = Record<string, string>;
/** What a request handler of a route module gets: the request, its path params, the CMS instance that serves it, and (admin routes) who is signed in. */
export interface AdminRequest<P extends Params = Params> {
    request: Request;
    params: P;
    auth: AuthContext;
    cms: Cms;
}
/** What a route that needs no login gets: the same without `auth`. Such a route checks the request itself. */
export type PublicRequest<P extends Params = Params> = Omit<AdminRequest<P>, "auth">;
export type AdminHandler<P extends Params = Params> = (input: AdminRequest<P>) => Promise<Response>;
export type PublicHandler<P extends Params = Params> = (input: PublicRequest<P>) => Promise<Response>;
/**
 * Runs an admin route: the same-origin check of a state-changing request, the admin check, the `[id]` shape, and the actor for the change record. Errors become the
 * one error answer. The router does this for every route that is not `public`, so a handler holds no auth code.
 */
export declare function runAdminRoute<P extends Params>(cms: Cms, request: Request, params: P, handler: AdminHandler<P>): Promise<Response>;
/**
 * Runs a public route: errors become the one error answer. A login connection may redirect by throwing (Next.js does); that signal must reach the host framework,
 * so it is offered to the connection first.
 */
export declare function runPublicRoute<P extends Params>(cms: Cms, request: Request, params: P, handler: PublicHandler<P>): Promise<Response>;
/**
 * Declares an admin route handler (a method of a route file). It only types the input: the router runs the same-origin and admin checks before it
 * (`runAdminRoute`), so a handler holds no auth code.
 *
 * ```ts
 * export const GET = adminRoute(async ({ request, params, auth, cms }) => ok(await cms.store().listFolders()));
 * ```
 */
export declare const adminRoute: <P extends Params = Params>(handler: AdminHandler<P>) => AdminHandler<P>;
/** Declares the handler of a `public: true` route. It needs no login and checks the request itself. */
export declare const publicRoute: <P extends Params = Params>(handler: PublicHandler<P>) => PublicHandler<P>;
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
export { deleted, ok };
