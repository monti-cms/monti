import type { z } from "zod";
import type { AuthContext } from "../../adapters/auth";
import type { Cms } from "../../cms";
import { HttpError, handleApiError } from "./error-handler";
import { validateSameOrigin } from "./security";

/**
 * Shared frame for admin API routes. Every admin request is authenticated on the server,
 * and state-changing requests go through the same-origin check first. Errors are converted to one shape in a single place.
 *
 * The request handler (`cms.handle()`, or `cms.routeHandler()` in Next) passes the CMS instance in the context of every route (`{ params, cms }`), so a route reads
 * stores and settings from `cms` instead of from module-level state.
 */

type Params = Record<string, string>;
/** What the route handler passes to a route: the path params and the CMS instance the request is served by. */
export type RouteContext<P extends Params = Params> = { params?: Promise<P>; cms: Cms };

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
export function adminRoute<P extends Params = Params>(
	handler: (input: AdminRequest<P>) => Promise<Response>,
	bound: { readonly cms?: Cms } = {},
): (request: Request, context?: Partial<RouteContext<P>>) => Promise<Response> {
	return async (request, context) => {
		try {
			const cms = context?.cms ?? bound.cms;
			if (!cms) {
				throw new Error(
					"admin route called without a CMS instance: serve it through `cms.handle()` or pass `{ cms }` when wrapping it",
				);
			}
			validateSameOrigin(request, { trustHost: cms.isHostTrusted() });
			const auth = await cms.authGateway.verifyAdmin();
			const params = (await context?.params) ?? ({} as P);
			return await handler({ request, params, auth, cms });
		} catch (error) {
			return handleApiError(error);
		}
	};
}

/** Reads the JSON body. 400 if malformed. A missing body is treated as `{}`. */
export async function readJsonBody(request: Request): Promise<unknown> {
	const text = await request.text();
	if (!text.trim()) return {};
	try {
		return JSON.parse(text);
	} catch {
		throw new HttpError(400, "invalid_input", "Request body is not valid JSON");
	}
}

/**
 * Change requests need the `version` from the read response. 428 if missing, and the store throws 409 if it differs from the server.
 * A missing version is rejected before a malformed body (400).
 */
export function assertVersionPresent(value: unknown): void {
	if (value === undefined || value === null || value === "") {
		throw new HttpError(428, "version_required", "expectedVersion is required");
	}
}

export function parseWith<S extends z.ZodType>(
	schema: S,
	value: unknown,
	message = "Invalid request body",
): z.output<S> {
	const parsed = schema.safeParse(value);
	if (!parsed.success) throw new HttpError(400, "invalid_input", message, parsed.error.issues);
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
		throw new HttpError(400, "invalid_input", "Invalid expectedVersion");
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
	if (!/^[a-z][a-z0-9-]*$/.test(raw)) throw new HttpError(400, "invalid_input", "Invalid format");
	return raw;
}

export const json = (body: unknown, init?: ResponseInit) => Response.json(body, init);
