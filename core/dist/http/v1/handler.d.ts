import type { z } from "zod";
import type { AuthContext } from "../../adapters/auth/index.js";
import type { Cms } from "../../cms/index.js";
import type { PluginContext } from "../../plugin/context.js";
import type { BulkItemResult } from "../../services/bulk-service.js";
import type { WriteResult } from "../../services/content-service.js";
import { CmsError, deleted, ok } from "./error-handler.js";
/**
 * Shared frame for admin API routes. Every admin request is authenticated on the server,
 * and state-changing requests go through the same-origin check first. Errors are converted to one shape in a single place.
 *
 * The request handler (`cms.handle()`, which a host package such as `@monti-cms/nextjs` mounts) passes the CMS instance in the context of every route (`{ params, cms }`), so a route reads
 * stores and settings from `cms` instead of from module-level state.
 */
type Params = Record<string, string>;
/**
 * What a request handler of a route module gets: the request, its path params, the CMS instance that serves it, the plugin that owns the route, and (admin routes)
 * who is signed in.
 */
export interface AdminRequest<P extends Params = Params> {
    request: Request;
    params: P;
    auth: AuthContext;
    cms: Cms;
    /**
     * The plugin that owns the route (`plugin.storage`, `plugin.secrets`, `plugin.key(id)`, `plugin.once`), so a route never names its own plugin. The core's own
     * routes are not a plugin's and never read it.
     */
    plugin: PluginContext;
}
/** What a route that needs no login gets: the same without `auth`. */
export type PublicRequest<P extends Params = Params> = Omit<AdminRequest<P>, "auth">;
export type AdminHandler<P extends Params = Params> = (input: AdminRequest<P>) => Promise<Response>;
export type PublicHandler<P extends Params = Params> = (input: PublicRequest<P>) => Promise<Response>;
/**
 * How a route is guarded. The router applies the guard of the kind before the handler runs, so a route cannot skip a check by forgetting it:
 * - `admin` (the default): the same-origin check of a state-changing request, then the admin login. For `AdminHandler`s.
 * - `public-read`: no login, and nothing but `GET`/`HEAD` (any other method is a 405). For the public JSON API.
 * - `same-origin-form`: no login, the same-origin check where a browser form post is accepted too. For the sign-in, sign-out and first-admin forms.
 * - `signed`: no login and no check of the router: the request proves itself (a webhook signature). The handler must verify it, and that is the only kind that leaves a check to the handler.
 * - `admin-or-bearer`: a request with a `Bearer` token reaches the handler, which verifies the token (a cron job, no cookie, so no same-origin check). A request without one is guarded as `admin`.
 */
export type RouteAccess = "admin" | "public-read" | "same-origin-form" | "signed" | "admin-or-bearer";
/** What a handler of an `admin-or-bearer` route gets: the admin guard has run when `auth` is set, and a request without `auth` carries a `Bearer` token that the handler must verify. */
export interface BearerRequest<P extends Params = Params> extends Omit<AdminRequest<P>, "auth"> {
    auth: AuthContext | null;
}
export type BearerHandler<P extends Params = Params> = (input: BearerRequest<P>) => Promise<Response>;
export declare const bearerTokenOf: (request: Request) => string | null;
/**
 * Runs an admin route: the same-origin check of a state-changing request, the admin check, the `[id]` shape, and the actor for the change record. Errors become the
 * one error answer. The router does this for every route of access `admin`, so a handler holds no auth code.
 */
export declare function runAdminRoute<P extends Params>(cms: Cms, request: Request, params: P, handler: AdminHandler<P>, plugin?: PluginContext): Promise<Response>;
/**
 * Runs a route of the given access kind (see {@link RouteAccess}): the guard of the kind, then the handler. Errors become the one error answer. A login connection may redirect
 * by throwing (Next.js does); that signal must reach the host framework, so a route that needs no login offers the error to the connection first.
 */
export declare function runRoute<P extends Params>(cms: Cms, request: Request, params: P, handler: AdminHandler<P> | PublicHandler<P> | BearerHandler<P>, access?: RouteAccess, 
/** The plugin that owns the route. A core route has none, and its handler never reads `plugin`. */
plugin?: PluginContext): Promise<Response>;
/**
 * Declares an admin route handler (a method of a route file). It only types the input: the router runs the same-origin and admin checks before it
 * (`runAdminRoute`), so a handler holds no auth code.
 *
 * ```ts
 * export const GET = adminRoute(async ({ request, params, auth, cms, plugin }) => ok(await plugin.storage.collection("items").list()));
 * ```
 */
export declare const adminRoute: <P extends Params = Params>(handler: AdminHandler<P>) => AdminHandler<P>;
/** Declares the handler of a route of access `public-read`, `same-origin-form` or `signed`: it gets no login, because the router's guard of the kind has run (a `signed` route verifies the request itself). */
export declare const publicRoute: <P extends Params = Params>(handler: PublicHandler<P>) => PublicHandler<P>;
/** Declares the handler of an `admin-or-bearer` route. A request with no `auth` carries a bearer token (`bearerTokenOf`) that the handler must verify. */
export declare const bearerRoute: <P extends Params = Params>(handler: BearerHandler<P>) => BearerHandler<P>;
/**
 * Reads the raw body, at most `maxBytes` of it. A declared `Content-Length` over the cap is refused before a byte is read; a body that does not declare one
 * (chunked) is read as a stream, counted, and cancelled the moment it passes the cap. `Content-Length` alone is not trusted: it can be missing or wrong.
 * 413 when over. Public routes use this too, so nothing is read unbounded before login or before a signature check.
 */
export declare function readBodyBytes(request: Request, maxBytes?: number): Promise<Uint8Array<ArrayBuffer>>;
/** Reads the body as UTF-8 text, at most `maxBytes` of it (see `readBodyBytes`). */
export declare function readBodyText(request: Request, maxBytes?: number): Promise<string>;
/** Reads a form post (urlencoded or multipart), at most `maxBytes` of it. The size is checked before the form is parsed. */
export declare function readFormBody(request: Request, maxBytes?: number): Promise<FormData>;
/** Reads the JSON body, at most `MAX_REQUEST_BYTES`. 413 if larger, 400 if malformed. A missing body is treated as `{}`. */
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
/** The answer to a write of the content service: the entry, and its warnings with their person's text (`text`, `where`) in the admin language. */
export declare const written: (cms: Cms, result: WriteResult, init?: ResponseInit) => Response;
/** The answer to a bulk operation: every item's warnings or issues with their person's text. */
export declare const bulkWritten: (cms: Cms, result: {
    readonly results: readonly BulkItemResult[];
}) => Response;
export { CmsError, deleted, ok };
