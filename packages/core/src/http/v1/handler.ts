import type { z } from "zod";
import type { AuthContext } from "../../adapters/auth";
import type { Cms } from "../../cms";
import { actorOf, withActor } from "../../core/actor";
import { isUuid } from "../../core/ids";
import { CmsError, deleted, handleApiError, ok } from "./error-handler";
import { validateSameOrigin } from "./security";

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
export async function runAdminRoute<P extends Params>(
	cms: Cms,
	request: Request,
	params: P,
	handler: AdminHandler<P>,
): Promise<Response> {
	try {
		validateSameOrigin(cms, request);
		const auth = await cms.authGateway.verifyAdmin();
		// Every `[id]` in the admin API is a UUID (entries, folders, templates, media, events, API keys). Anything else cannot exist, and the database
		// would reject it as a malformed value (an internal error), so it is a missing item here.
		if (typeof params.id === "string" && !isUuid(params.id)) {
			throw new CmsError("Not found", "not_found");
		}
		// The store records this admin as the one who made the changes the handler writes (`changedBy`).
		return await withActor(actorOf(auth), () => handler({ request, params, auth, cms }));
	} catch (error) {
		return handleApiError(error);
	}
}

/**
 * Runs a public route: errors become the one error answer. A login connection may redirect by throwing (Next.js does); that signal must reach the host framework,
 * so it is offered to the connection first.
 */
export async function runPublicRoute<P extends Params>(
	cms: Cms,
	request: Request,
	params: P,
	handler: PublicHandler<P>,
): Promise<Response> {
	try {
		return await handler({ request, params, cms });
	} catch (error) {
		let auth: ReturnType<Cms["auth"]> | undefined;
		try {
			auth = cms.auth();
		} catch {
			// No login connection to ask: the error is answered as it is.
		}
		auth?.rethrow?.(error);
		return handleApiError(error);
	}
}

/**
 * Declares an admin route handler (a method of a route file). It only types the input: the router runs the same-origin and admin checks before it
 * (`runAdminRoute`), so a handler holds no auth code.
 *
 * ```ts
 * export const GET = adminRoute(async ({ request, params, auth, cms }) => ok(await cms.store().listFolders()));
 * ```
 */
export const adminRoute = <P extends Params = Params>(handler: AdminHandler<P>): AdminHandler<P> => handler;

/** Declares the handler of a `public: true` route. It needs no login and checks the request itself. */
export const publicRoute = <P extends Params = Params>(handler: PublicHandler<P>): PublicHandler<P> => handler;

/** Reads the JSON body. 400 if malformed. A missing body is treated as `{}`. */
export async function readJsonBody(request: Request): Promise<unknown> {
	const text = await request.text();
	if (!text.trim()) return {};
	try {
		return JSON.parse(text);
	} catch {
		throw new CmsError("Request body is not valid JSON", "invalid_input");
	}
}

/**
 * Change requests need the `version` from the read response. 428 if missing, and the store throws 409 if it differs from the server.
 * A missing version is rejected before a malformed body (400).
 */
export function assertVersionPresent(value: unknown): void {
	if (value === undefined || value === null || value === "") {
		throw new CmsError("expectedVersion is required", "version_required");
	}
}

export function parseWith<S extends z.ZodType>(
	schema: S,
	value: unknown,
	message = "Invalid request body",
): z.output<S> {
	const parsed = schema.safeParse(value);
	if (!parsed.success) throw new CmsError(message, "invalid_input", undefined, undefined, parsed.error.issues);
	return parsed.data;
}

/** Reads the body, checks that a version is present, then validates it against the schema. */
export async function readVersionedBody<S extends z.ZodType>(request: Request, schema: S): Promise<z.output<S>> {
	const body = await readJsonBody(request);
	assertVersionPresent((body as { expectedVersion?: unknown })?.expectedVersion);
	return parseWith(schema, body);
}

/** The `expectedVersion` query param (DELETE requests). */
export function readVersionQuery(request: Request): number {
	const raw = new URL(request.url).searchParams.get("expectedVersion");
	assertVersionPresent(raw ?? undefined);
	const version = Number(raw);
	if (!Number.isInteger(version) || version <= 0) {
		throw new CmsError("Invalid expectedVersion", "invalid_input");
	}
	return version;
}

/** Converts the query to an object. Keys in `arrayKeys` may appear multiple times. */
export function readQuery(request: Request, arrayKeys: readonly string[] = []): Record<string, unknown> {
	const query: Record<string, unknown> = {};
	const params = new URL(request.url).searchParams;
	for (const key of new Set(params.keys())) {
		query[key] = arrayKeys.includes(key) ? params.getAll(key) : params.get(key);
	}
	return query;
}

/** The `format` query param of a read, or `undefined`. An invalid name is a 400; whether the format is installed is decided where it is used. */
export function readFormatQuery(request: Request): string | undefined {
	const raw = new URL(request.url).searchParams.get("format");
	if (raw === null || raw === "") return undefined;
	if (!/^[a-z][a-z0-9-]*$/.test(raw)) throw new CmsError("Invalid format", "invalid_input");
	return raw;
}

export { CmsError, deleted, ok };
