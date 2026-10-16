import type { z } from "zod";
import type { AuthContext } from "../../adapters/auth";
import type { Cms } from "../../cms";
import { actorOf, withActor } from "../../core/actor";
import { isUuid } from "../../core/ids";
import { MAX_FORM_BYTES, MAX_REQUEST_BYTES } from "../../core/limits";
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

export const bearerTokenOf = (request: Request): string | null =>
	/^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? null;

/** Runs the handler of an admin request: the same-origin check, the admin check, the `[id]` shape, and the actor for the change record. */
async function guardedAdmin<P extends Params, R>(
	cms: Cms,
	request: Request,
	params: P,
	run: (auth: AuthContext) => Promise<R>,
): Promise<R> {
	validateSameOrigin(cms, request);
	const auth = await cms.authGateway.verifyAdmin();
	// Every `[id]` in the admin API is a UUID (entries, folders, templates, media, events, API keys). Anything else cannot exist, and the database
	// would reject it as a malformed value (an internal error), so it is a missing item here.
	if (typeof params.id === "string" && !isUuid(params.id)) {
		throw new CmsError("Not found", "not_found");
	}
	// The store records this admin as the one who made the changes the handler writes (`changedBy`).
	return withActor(actorOf(auth), () => run(auth));
}

/**
 * Runs an admin route: the same-origin check of a state-changing request, the admin check, the `[id]` shape, and the actor for the change record. Errors become the
 * one error answer. The router does this for every route of access `admin`, so a handler holds no auth code.
 */
export async function runAdminRoute<P extends Params>(
	cms: Cms,
	request: Request,
	params: P,
	handler: AdminHandler<P>,
): Promise<Response> {
	try {
		return await guardedAdmin(cms, request, params, (auth) => handler({ request, params, auth, cms }));
	} catch (error) {
		return handleApiError(error);
	}
}

/**
 * Runs a route of the given access kind (see {@link RouteAccess}): the guard of the kind, then the handler. Errors become the one error answer. A login connection may redirect
 * by throwing (Next.js does); that signal must reach the host framework, so a route that needs no login offers the error to the connection first.
 */
export async function runRoute<P extends Params>(
	cms: Cms,
	request: Request,
	params: P,
	handler: AdminHandler<P> | PublicHandler<P> | BearerHandler<P>,
	access: RouteAccess = "admin",
): Promise<Response> {
	if (access === "admin") return runAdminRoute(cms, request, params, handler as AdminHandler<P>);
	try {
		switch (access) {
			case "public-read": {
				const method = request.method.toUpperCase();
				if (method !== "GET" && method !== "HEAD") {
					throw new CmsError(`${method} is not allowed here`, "method_not_allowed");
				}
				break;
			}
			case "same-origin-form":
				validateSameOrigin(cms, request, { form: true });
				break;
			case "admin-or-bearer":
				if (bearerTokenOf(request) === null) {
					return await guardedAdmin(cms, request, params, (auth) =>
						(handler as BearerHandler<P>)({ request, params, auth, cms }),
					);
				}
				return await (handler as BearerHandler<P>)({ request, params, auth: null, cms });
			case "signed":
				break;
		}
		return await (handler as PublicHandler<P>)({ request, params, cms });
	} catch (error) {
		if (access === "admin-or-bearer") return handleApiError(error);
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

/** Declares the handler of a route of access `public-read`, `same-origin-form` or `signed`: it gets no login, because the router's guard of the kind has run (a `signed` route verifies the request itself). */
export const publicRoute = <P extends Params = Params>(handler: PublicHandler<P>): PublicHandler<P> => handler;

/** Declares the handler of an `admin-or-bearer` route. A request with no `auth` carries a bearer token (`bearerTokenOf`) that the handler must verify. */
export const bearerRoute = <P extends Params = Params>(handler: BearerHandler<P>): BearerHandler<P> => handler;

const tooLarge = (maxBytes: number) => new CmsError(`Request body exceeds ${maxBytes} bytes`, "payload_too_large");

/**
 * Reads the raw body, at most `maxBytes` of it. A declared `Content-Length` over the cap is refused before a byte is read; a body that does not declare one
 * (chunked) is read as a stream, counted, and cancelled the moment it passes the cap. `Content-Length` alone is not trusted: it can be missing or wrong.
 * 413 when over. Public routes use this too, so nothing is read unbounded before login or before a signature check.
 */
export async function readBodyBytes(
	request: Request,
	maxBytes: number = MAX_REQUEST_BYTES,
): Promise<Uint8Array<ArrayBuffer>> {
	const declared = Number(request.headers.get("content-length"));
	if (Number.isFinite(declared) && declared > maxBytes) throw tooLarge(maxBytes);
	if (!request.body) return new Uint8Array();
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let total = 0;
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		total += value.byteLength;
		if (total > maxBytes) {
			await reader.cancel().catch(() => {});
			throw tooLarge(maxBytes);
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(total);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.byteLength;
	}
	return bytes;
}

/** Reads the body as UTF-8 text, at most `maxBytes` of it (see `readBodyBytes`). */
export async function readBodyText(request: Request, maxBytes: number = MAX_REQUEST_BYTES): Promise<string> {
	return new TextDecoder().decode(await readBodyBytes(request, maxBytes));
}

/** Reads a form post (urlencoded or multipart), at most `maxBytes` of it. The size is checked before the form is parsed. */
export async function readFormBody(request: Request, maxBytes: number = MAX_FORM_BYTES): Promise<FormData> {
	const bytes = await readBodyBytes(request, maxBytes);
	const contentType = request.headers.get("content-type");
	try {
		return await new Response(new Blob([bytes]), {
			headers: contentType ? { "content-type": contentType } : {},
		}).formData();
	} catch {
		throw new CmsError("Request body is not a valid form", "invalid_input");
	}
}

/** Reads the JSON body, at most `MAX_REQUEST_BYTES`. 413 if larger, 400 if malformed. A missing body is treated as `{}`. */
export async function readJsonBody(request: Request): Promise<unknown> {
	const text = await readBodyText(request);
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
