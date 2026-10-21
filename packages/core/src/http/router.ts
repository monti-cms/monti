import type { Cms, HandleOptions } from "../cms";
import { hostOf } from "../cms/host";
import { CMS_API_PATH, cmsBasePath } from "../core/base-path";
import { assertPluginRoutesFree } from "../plugin/collisions";
import { CMS_AUTH_BASE_PATH } from "../server/define";
import * as rApiKeyItem from "./v1/api-keys/[id]/route";
import * as rApiKeys from "./v1/api-keys/route";
import * as rApiKeySlots from "./v1/api-keys/slots/route";
import * as rBulk from "./v1/bulk/route";
import * as rEntryArchive from "./v1/entries/[id]/archive/route";
import * as rEntryCheck from "./v1/entries/[id]/check/route";
import * as rEntryDuplicate from "./v1/entries/[id]/duplicate/route";
import * as rEntryPublish from "./v1/entries/[id]/publish/route";
import * as rEntryRelations from "./v1/entries/[id]/relations/route";
import * as rEntryRestore from "./v1/entries/[id]/restore/route";
import * as rEntry from "./v1/entries/[id]/route";
import * as rEntryTranslations from "./v1/entries/[id]/translations/route";
import * as rEntryTrash from "./v1/entries/[id]/trash/route";
import * as rEntryUnarchive from "./v1/entries/[id]/unarchive/route";
import * as rEntries from "./v1/entries/route";
import * as rEntrySearch from "./v1/entries/search/route";
import { CmsError, handleApiError } from "./v1/error-handler";
import * as rEventDismiss from "./v1/events/[id]/dismiss/route";
import * as rEventRetry from "./v1/events/[id]/retry/route";
import * as rEventsRetry from "./v1/events/retry/route";
import * as rEvents from "./v1/events/route";
import * as rExport from "./v1/export/route";
import * as rExportSummary from "./v1/export/summary/route";
import * as rFolder from "./v1/folders/[id]/route";
import * as rFolders from "./v1/folders/route";
import { type RouteAccess, runRoute } from "./v1/handler";
import * as rImportEntries from "./v1/import/entries/route";
import * as rImportRestore from "./v1/import/restore/route";
import * as rMediaComplete from "./v1/media/[id]/complete/route";
import * as rMediaItem from "./v1/media/[id]/route";
import * as rMediaCleanup from "./v1/media/cleanup/route";
import * as rMedia from "./v1/media/route";
import * as rMediaUploads from "./v1/media/uploads/route";
import * as rMeta from "./v1/meta/route";
import * as rPreferences from "./v1/preferences/route";
import * as rPublicItem from "./v1/public/entries/[collection]/[slug]/route";
import * as rPublicList from "./v1/public/entries/route";
import * as rSchemaPreview from "./v1/schema/preview/route";
import * as rSchema from "./v1/schema/route";
import * as rSessionFirstAdmin from "./v1/session/first-admin/route";
import * as rSessionSignIn from "./v1/session/sign-in/[provider]/route";
import * as rSessionSignOut from "./v1/session/sign-out/route";
import * as rTemplate from "./v1/templates/[id]/route";
import * as rTemplates from "./v1/templates/route";

/**
 * Admin API (`/api/monti/v1/*`) route table, served by `cms.handle(request)` (a Next app mounts it with `createRouteHandler(cms)` of `@monti-cms/nextjs` from a single catch-all route,
 * `app/api/monti/[...path]/route.ts`). Paths mirror the route folders (`[id]` is one segment).
 * Every route gets the CMS instance in its context (`{ params, cms }`).
 */

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
const METHODS: readonly string[] = ["GET", "POST", "PATCH", "PUT", "DELETE"];
const isMethod = (value: string): value is Method => METHODS.includes(value);
/** A method of a route file: `adminRoute(...)` for an `admin` route, `publicRoute(...)` for a `public-read`, `same-origin-form` or `signed` one, `bearerRoute(...)` for `admin-or-bearer`. The params (`{ id }` etc.) differ per route. */
type RouteModule = Partial<Record<Method, unknown>>;

/**
 * One route: its path pattern and module. `access` says who may call it and which guard the router applies (default `admin`). `enabled` ties the route to a
 * site feature: when the site has the feature off, the path answers 404 for every method, so turning a feature off in the config closes its API as well as
 * its screens.
 */
type Route = { pattern: string; module: RouteModule; access?: RouteAccess; enabled?: (cms: Cms) => boolean };

/** `admin.templates: false` turns off body templates: the Templates screen, the editor's menu and these routes. */
const templatesEnabled = (cms: Cms) => cms.site.ADMIN_TEMPLATES;

const ROUTES: readonly Route[] = [
	// The central API key store: names, masked tails and the places that use each key. A value goes in on save and never comes back.
	{ pattern: "v1/api-keys", module: rApiKeys },
	// Named before `[id]`, so `slots` is not read as a key id.
	{ pattern: "v1/api-keys/slots", module: rApiKeySlots },
	{ pattern: "v1/api-keys/[id]", module: rApiKeyItem },
	{ pattern: "v1/bulk", module: rBulk },
	{ pattern: "v1/entries", module: rEntries },
	// Named before `[id]`, so `search` is not read as an entry id.
	{ pattern: "v1/entries/search", module: rEntrySearch },
	{ pattern: "v1/entries/[id]", module: rEntry },
	{ pattern: "v1/entries/[id]/archive", module: rEntryArchive },
	{ pattern: "v1/entries/[id]/check", module: rEntryCheck },
	{ pattern: "v1/entries/[id]/duplicate", module: rEntryDuplicate },
	{ pattern: "v1/entries/[id]/publish", module: rEntryPublish },
	{ pattern: "v1/entries/[id]/relations", module: rEntryRelations },
	{ pattern: "v1/entries/[id]/restore", module: rEntryRestore },
	{ pattern: "v1/entries/[id]/translations", module: rEntryTranslations },
	{ pattern: "v1/entries/[id]/trash", module: rEntryTrash },
	{ pattern: "v1/entries/[id]/unarchive", module: rEntryUnarchive },
	// The event outbox: failed and dead durable entry event deliveries. `v1/events/retry` also takes the retry secret of the server config (for a cron job).
	{ pattern: "v1/events", module: rEvents },
	{ pattern: "v1/events/retry", access: "admin-or-bearer", module: rEventsRetry },
	{ pattern: "v1/events/[id]/retry", module: rEventRetry },
	{ pattern: "v1/events/[id]/dismiss", module: rEventDismiss },
	{ pattern: "v1/export", module: rExport },
	{ pattern: "v1/export/summary", module: rExportSummary },
	{ pattern: "v1/import/entries", access: "admin-upload", module: rImportEntries },
	{ pattern: "v1/import/restore", access: "admin-upload", module: rImportRestore },
	{ pattern: "v1/folders", module: rFolders },
	{ pattern: "v1/folders/[id]", module: rFolder },
	{ pattern: "v1/media", module: rMedia },
	{ pattern: "v1/media/cleanup", module: rMediaCleanup },
	{ pattern: "v1/media/uploads", module: rMediaUploads },
	{ pattern: "v1/media/[id]", module: rMediaItem },
	{ pattern: "v1/media/[id]/complete", module: rMediaComplete },
	{ pattern: "v1/meta", module: rMeta },
	{ pattern: "v1/preferences", module: rPreferences },
	// The schema settings screen: reading works everywhere, the write routes answer 403 outside development.
	{ pattern: "v1/schema", module: rSchema },
	{ pattern: "v1/schema/preview", module: rSchemaPreview },
	// Routes with an `access` other than `admin` need no login, and the router applies the guard of the kind: sign in and out of the admin (browser form posts from the login screen,
	// `same-origin-form`), the events retry (an admin or the retry secret, `admin-or-bearer`), and the public JSON API (`public-read`, GET only). Every other route is `admin`: same origin, admin, then the handler.
	{ pattern: "v1/session/first-admin", access: "same-origin-form", module: rSessionFirstAdmin },
	{ pattern: "v1/session/sign-in/[provider]", access: "same-origin-form", module: rSessionSignIn },
	{ pattern: "v1/session/sign-out", access: "same-origin-form", module: rSessionSignOut },
	// Public JSON API (published content only, no login). 404 if the server config has no `publicApi`.
	{ pattern: "v1/public/entries", access: "public-read", module: rPublicList },
	{ pattern: "v1/public/entries/[collection]/[slug]", access: "public-read", module: rPublicItem },
	{ pattern: "v1/templates", module: rTemplates, enabled: templatesEnabled },
	{ pattern: "v1/templates/[id]", module: rTemplate, enabled: templatesEnabled },
];

type CompiledRoute = {
	segments: string[];
	module: RouteModule;
	access: RouteAccess;
	enabled?: (cms: Cms) => boolean;
	/** The plugin that owns the route; core routes have none. */
	plugin?: string;
};
const compile = (routes: readonly (Route & { readonly plugin?: string })[]): CompiledRoute[] =>
	routes.map((route) => ({
		segments: route.pattern.split("/"),
		module: route.module,
		access: route.access ?? "admin",
		enabled: route.enabled,
		...(route.plugin ? { plugin: route.plugin } : {}),
	}));
const COMPILED = compile(ROUTES);

/** The route and params matching the path segments. Named segments match before `[name]` segments (table order). */
export function matchRoute(
	path: readonly string[],
	routes: readonly CompiledRoute[] = COMPILED,
): {
	module: RouteModule;
	params: Record<string, string>;
	access: RouteAccess;
	enabled?: (cms: Cms) => boolean;
	plugin?: string;
} | null {
	for (const { segments, module, access, enabled, plugin } of routes) {
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
		if (matched) return { module, params, access, enabled, ...(plugin ? { plugin } : {}) };
	}
	return null;
}

/** Registered admin API paths (for docs and tests). */
export const CMS_ROUTE_PATTERNS: readonly string[] = ROUTES.map((route) => route.pattern);

/**
 * The path segments after the API prefix (`/api/monti/`), read from the request URL: `["v1", "entries", "<id>"]` for `/api/monti/v1/entries/<id>`.
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
 * `auth/*` is forwarded to the auth handler when the auth base path is the default (`/api/monti/auth`), so no separate auth route file is needed.
 */
export function createRequestHandler(cms: Cms): (request: Request, options?: HandleOptions) => Promise<Response> {
	let pluginCompiled: Promise<CompiledRoute[]> | undefined;
	const compiledPluginRoutes = () => {
		// A plugin route is checked like a core one (an `access` other than `admin` is the plugin's explicit choice), so a missing auth check never becomes an open route.
		// A path that collides with a core route or another plugin is an error (the core would match first and silently shadow the plugin route). Failures are not cached.
		pluginCompiled ??= hostOf(cms)
			.pluginRoutes()
			.then((routes) => {
				assertPluginRoutesFree(
					ROUTES.map((route) => route.pattern),
					routes,
				);
				return compile(routes);
			})
			.catch((error) => {
				pluginCompiled = undefined;
				throw error;
			});
		return pluginCompiled;
	};
	const notFound = () => handleApiError(new CmsError("Unknown CMS API path", "not_found"), cms.site);
	return async (request, options) => {
		const path = options?.path ?? pathFromRequest(request);
		if (!path) return notFound();
		const method = request.method.toUpperCase();
		if (!isMethod(method)) {
			return handleApiError(new CmsError(`${method} is not allowed here`, "method_not_allowed"), cms.site);
		}
		if (path[0] === "auth") {
			const auth = cms.auth();
			if (auth.basePath !== CMS_AUTH_BASE_PATH) return notFound();
			if (method !== "GET" && method !== "POST") {
				return handleApiError(new CmsError(`${method} is not allowed here`, "method_not_allowed"), cms.site);
			}
			return auth.handlers[method](request);
		}
		// If not a core route, look in the plugin route table.
		const matched = matchRoute(path) ?? matchRoute(path, await compiledPluginRoutes());
		if (!matched || matched.enabled?.(cms) === false) return notFound();
		const handler = matched.module[method];
		if (typeof handler !== "function") {
			return handleApiError(new CmsError(`${method} is not allowed here`, "method_not_allowed"), cms.site);
		}
		return runRoute(
			cms,
			request,
			matched.params,
			handler as Parameters<typeof runRoute>[3],
			matched.access,
			matched.plugin ? cms.plugin(matched.plugin) : undefined,
		);
	};
}
