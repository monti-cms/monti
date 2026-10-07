import type { Cms, HandleOptions } from "../cms";
import { CMS_API_PATH, cmsBasePath } from "../core/base-path";
import { assertPluginRoutesFree } from "../plugin/collisions";
import { CMS_AUTH_BASE_PATH } from "../server/define";
import * as r9 from "./v1/bulk/route";
import * as r12 from "./v1/entries/[id]/archive/route";
import * as r13 from "./v1/entries/[id]/duplicate/route";
import * as r14 from "./v1/entries/[id]/publish/route";
import * as r15 from "./v1/entries/[id]/relations/route";
import * as r16 from "./v1/entries/[id]/restore/route";
import * as r11 from "./v1/entries/[id]/route";
import * as r18 from "./v1/entries/[id]/translations/route";
import * as r19 from "./v1/entries/[id]/trash/route";
import * as r20 from "./v1/entries/[id]/unarchive/route";
import * as r10 from "./v1/entries/route";
import { HttpError, handleApiError } from "./v1/error-handler";
import * as r21 from "./v1/export/route";
import * as r23 from "./v1/folders/[id]/route";
import * as r22 from "./v1/folders/route";
import * as r28 from "./v1/media/[id]/complete/route";
import * as r27 from "./v1/media/[id]/route";
import * as r25 from "./v1/media/cleanup/route";
import * as r24 from "./v1/media/route";
import * as r26 from "./v1/media/uploads/route";
import * as r29 from "./v1/meta/route";
import * as r30 from "./v1/preferences/route";
import * as rPublicEntry from "./v1/public/entries/[collection]/[slug]/route";
import * as rPublicEntries from "./v1/public/entries/route";
import * as rSchemaPreview from "./v1/schema/preview/route";
import * as rSchema from "./v1/schema/route";
import { validateSameOrigin } from "./v1/security";
import * as rSignIn from "./v1/session/sign-in/[provider]/route";
import * as rSignOut from "./v1/session/sign-out/route";
import * as r34 from "./v1/templates/[id]/route";
import * as r33 from "./v1/templates/route";

/**
 * Admin API (`/api/cms/v1/*`) route table, served by `cms.handle(request)` (a Next app mounts it with `createRouteHandler(cms)` of `@monti-cms/nextjs` from a single catch-all route,
 * `app/api/cms/[...path]/route.ts`). Paths mirror the route folders (`[id]` is one segment).
 * Every route gets the CMS instance in its context (`{ params, cms }`).
 */

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
const METHODS: readonly string[] = ["GET", "POST", "PATCH", "PUT", "DELETE"];
const isMethod = (value: string): value is Method => METHODS.includes(value);
type RouteHandler = (
	request: Request,
	context: { params: Promise<Record<string, string>>; cms: Cms },
) => Promise<Response>;
/** Route file. Handler params (`{ id }` etc.) differ per route, so they are called as `RouteHandler`. */
type RouteModule = Partial<Record<Method, unknown>>;

const ROUTES: ReadonlyArray<{ pattern: string; module: RouteModule }> = [
	{ pattern: "v1/bulk", module: r9 },
	{ pattern: "v1/entries", module: r10 },
	{ pattern: "v1/entries/[id]", module: r11 },
	{ pattern: "v1/entries/[id]/archive", module: r12 },
	{ pattern: "v1/entries/[id]/duplicate", module: r13 },
	{ pattern: "v1/entries/[id]/publish", module: r14 },
	{ pattern: "v1/entries/[id]/relations", module: r15 },
	{ pattern: "v1/entries/[id]/restore", module: r16 },
	{ pattern: "v1/entries/[id]/translations", module: r18 },
	{ pattern: "v1/entries/[id]/trash", module: r19 },
	{ pattern: "v1/entries/[id]/unarchive", module: r20 },
	{ pattern: "v1/export", module: r21 },
	{ pattern: "v1/folders", module: r22 },
	{ pattern: "v1/folders/[id]", module: r23 },
	{ pattern: "v1/media", module: r24 },
	{ pattern: "v1/media/cleanup", module: r25 },
	{ pattern: "v1/media/uploads", module: r26 },
	{ pattern: "v1/media/[id]", module: r27 },
	{ pattern: "v1/media/[id]/complete", module: r28 },
	{ pattern: "v1/meta", module: r29 },
	{ pattern: "v1/preferences", module: r30 },
	// The schema settings screen: reading works everywhere, the write routes answer 403 outside development.
	{ pattern: "v1/schema", module: rSchema },
	{ pattern: "v1/schema/preview", module: rSchemaPreview },
	// Sign in and out of the admin (browser form posts from the login screen). They check the same origin themselves and need no login.
	{ pattern: "v1/session/sign-in/[provider]", module: rSignIn },
	{ pattern: "v1/session/sign-out", module: rSignOut },
	// Public JSON API (published content only, no login). 404 if the server config has no `publicApi`.
	{ pattern: "v1/public/entries", module: rPublicEntries },
	{ pattern: "v1/public/entries/[collection]/[slug]", module: rPublicEntry },
	{ pattern: "v1/templates", module: r33 },
	{ pattern: "v1/templates/[id]", module: r34 },
];

type CompiledRoute = { segments: string[]; module: RouteModule; guarded: boolean };
const compile = (
	routes: ReadonlyArray<{ pattern: string; module: RouteModule; public?: boolean }>,
	guarded: boolean,
): CompiledRoute[] =>
	routes.map((route) => ({
		segments: route.pattern.split("/"),
		module: route.module,
		guarded: guarded && !route.public,
	}));
// Core routes wrap themselves with `adminRoute`.
const COMPILED = compile(ROUTES, false);

/** The route and params matching the path segments. Named segments match before `[name]` segments (table order). */
export function matchRoute(
	path: readonly string[],
	routes: readonly CompiledRoute[] = COMPILED,
): { module: RouteModule; params: Record<string, string>; guarded: boolean } | null {
	for (const { segments, module, guarded } of routes) {
		if (segments.length !== path.length) continue;
		const params: Record<string, string> = {};
		const matched = segments.every((segment, index) => {
			const part = path[index] ?? "";
			if (segment.startsWith("[") && segment.endsWith("]")) {
				params[segment.slice(1, -1)] = part;
				return part !== "";
			}
			return segment === part;
		});
		if (matched) return { module, params, guarded };
	}
	return null;
}

/** Registered admin API paths (for docs and tests). */
export const CMS_ROUTE_PATTERNS: readonly string[] = ROUTES.map((route) => route.pattern);

const notFound = () => handleApiError(new HttpError(404, "not_found", "Unknown CMS API path"));

/**
 * The path segments after the API prefix (`/api/cms/`), read from the request URL: `["v1", "entries", "<id>"]` for `/api/cms/v1/entries/<id>`.
 * The site's `basePath` is skipped when the URL has it. `null` if the URL is not under the API prefix.
 */
export function pathFromRequest(request: Request): string[] | null {
	let pathname = new URL(request.url).pathname;
	const basePath = cmsBasePath();
	if (basePath && (pathname === basePath || pathname.startsWith(`${basePath}/`))) {
		pathname = pathname.slice(basePath.length);
	}
	if (!pathname.startsWith(`${CMS_API_PATH}/`)) return null;
	try {
		return pathname
			.slice(CMS_API_PATH.length + 1)
			.split("/")
			.filter((segment) => segment !== "")
			.map(decodeURIComponent);
	} catch {
		return null;
	}
}

/**
 * The request handler of one CMS instance (`cms.handle()` calls it): standard `Request` in, `Response` out, no framework types.
 * `auth/*` is forwarded to the auth handler when the auth base path is the default (`/api/cms/auth`), so no separate auth route file is needed.
 */
export function createRequestHandler(cms: Cms): (request: Request, options?: HandleOptions) => Promise<Response> {
	let pluginCompiled: Promise<CompiledRoute[]> | undefined;
	const compiledPluginRoutes = () => {
		// The core wraps plugin routes with the admin check (only `public: true` is skipped), so a missing auth check never becomes an open route.
		// A path that collides with a core route or another plugin is an error (the core would match first and silently shadow the plugin route). Failures are not cached.
		pluginCompiled ??= cms
			.pluginRoutes()
			.then((routes) => {
				assertPluginRoutesFree(
					ROUTES.map((route) => route.pattern),
					routes,
				);
				return compile(routes, true);
			})
			.catch((error) => {
				pluginCompiled = undefined;
				throw error;
			});
		return pluginCompiled;
	};
	return async (request, options) => {
		const path = options?.path ?? pathFromRequest(request);
		if (!path) return notFound();
		const method = request.method.toUpperCase();
		if (!isMethod(method)) {
			return handleApiError(new HttpError(405, "method_not_allowed", `${method} is not allowed here`));
		}
		if (path[0] === "auth") {
			const auth = cms.auth();
			if (auth.basePath !== CMS_AUTH_BASE_PATH) return notFound();
			if (method !== "GET" && method !== "POST") {
				return handleApiError(new HttpError(405, "method_not_allowed", `${method} is not allowed here`));
			}
			return auth.handlers[method](request);
		}
		// If not a core route, look in the plugin route table.
		const matched = matchRoute(path) ?? matchRoute(path, await compiledPluginRoutes());
		if (!matched) return notFound();
		const handler = matched.module[method] as RouteHandler | undefined;
		if (!handler) {
			return handleApiError(new HttpError(405, "method_not_allowed", `${method} is not allowed here`));
		}
		if (matched.guarded) {
			try {
				validateSameOrigin(cms, request);
				await cms.authGateway.verifyAdmin();
			} catch (error) {
				return handleApiError(error);
			}
		}
		return handler(request, { params: Promise.resolve(matched.params), cms });
	};
}
