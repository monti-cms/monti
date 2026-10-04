import { authGateway } from "../adapters/auth/index.js";
import { getCmsAuth } from "../container.js";
import { assertPluginRoutesFree } from "../plugin/collisions.js";
import { pluginRoutes } from "../plugin/server.js";
import { CMS_AUTH_BASE_PATH } from "../server/define.js";
import * as r9 from "./v1/bulk/route.js";
import * as r12 from "./v1/entries/[id]/archive/route.js";
import * as r13 from "./v1/entries/[id]/duplicate/route.js";
import * as r14 from "./v1/entries/[id]/publish/route.js";
import * as r15 from "./v1/entries/[id]/relations/route.js";
import * as r16 from "./v1/entries/[id]/restore/route.js";
import * as r11 from "./v1/entries/[id]/route.js";
import * as r18 from "./v1/entries/[id]/translations/route.js";
import * as r19 from "./v1/entries/[id]/trash/route.js";
import * as r20 from "./v1/entries/[id]/unarchive/route.js";
import * as r10 from "./v1/entries/route.js";
import { HttpError, handleApiError } from "./v1/error-handler.js";
import * as r21 from "./v1/export/route.js";
import * as r23 from "./v1/folders/[id]/route.js";
import * as r22 from "./v1/folders/route.js";
import * as r28 from "./v1/media/[id]/complete/route.js";
import * as r27 from "./v1/media/[id]/route.js";
import * as r25 from "./v1/media/cleanup/route.js";
import * as r24 from "./v1/media/route.js";
import * as r26 from "./v1/media/uploads/route.js";
import * as r29 from "./v1/meta/route.js";
import * as r30 from "./v1/preferences/route.js";
import * as rPublicEntry from "./v1/public/entries/[collection]/[slug]/route.js";
import * as rPublicEntries from "./v1/public/entries/route.js";
import { validateSameOrigin } from "./v1/security.js";
import * as r34 from "./v1/templates/[id]/route.js";
import * as r33 from "./v1/templates/route.js";
const ROUTES = [
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
    // Public JSON API (published content only, no login). 404 if the server config has no `publicApi`.
    { pattern: "v1/public/entries", module: rPublicEntries },
    { pattern: "v1/public/entries/[collection]/[slug]", module: rPublicEntry },
    { pattern: "v1/templates", module: r33 },
    { pattern: "v1/templates/[id]", module: r34 },
];
const compile = (routes, guarded) => routes.map((route) => ({
    segments: route.pattern.split("/"),
    module: route.module,
    guarded: guarded && !route.public,
}));
// Core routes wrap themselves with `adminRoute`.
const COMPILED = compile(ROUTES, false);
let pluginCompiled;
const compiledPluginRoutes = () => {
    // The core wraps plugin routes with the admin check (only `public: true` is skipped), so a missing auth check never becomes an open route.
    // A path that collides with a core route or another plugin is an error (the core would match first and silently shadow the plugin route). Failures are not cached.
    pluginCompiled ??= pluginRoutes()
        .then((routes) => {
        assertPluginRoutesFree(ROUTES.map((route) => route.pattern), routes);
        return compile(routes, true);
    })
        .catch((error) => {
        pluginCompiled = undefined;
        throw error;
    });
    return pluginCompiled;
};
/** The route and params matching the path segments. Named segments match before `[name]` segments (table order). */
export function matchRoute(path, routes = COMPILED) {
    for (const { segments, module, guarded } of routes) {
        if (segments.length !== path.length)
            continue;
        const params = {};
        const matched = segments.every((segment, index) => {
            const part = path[index] ?? "";
            if (segment.startsWith("[") && segment.endsWith("]")) {
                params[segment.slice(1, -1)] = part;
                return part !== "";
            }
            return segment === part;
        });
        if (matched)
            return { module, params, guarded };
    }
    return null;
}
/** Registered admin API paths (for docs and tests). */
export const CMS_ROUTE_PATTERNS = ROUTES.map((route) => route.pattern);
const notFound = () => handleApiError(new HttpError(404, "not_found", "Unknown CMS API path"));
export function createCmsRouteHandler() {
    const handle = (method) => async (request, context) => {
        const { path = [] } = await context.params;
        if (path[0] === "auth") {
            const auth = getCmsAuth();
            if (auth.basePath !== CMS_AUTH_BASE_PATH)
                return notFound();
            if (method !== "GET" && method !== "POST") {
                return handleApiError(new HttpError(405, "method_not_allowed", `${method} is not allowed here`));
            }
            return auth.handlers[method](request);
        }
        // If not a core route, look in the plugin route table.
        const matched = matchRoute(path) ?? matchRoute(path, await compiledPluginRoutes());
        if (!matched)
            return notFound();
        const handler = matched.module[method];
        if (!handler) {
            return handleApiError(new HttpError(405, "method_not_allowed", `${method} is not allowed here`));
        }
        if (matched.guarded) {
            try {
                validateSameOrigin(request);
                await authGateway.verifyAdmin();
            }
            catch (error) {
                return handleApiError(error);
            }
        }
        return handler(request, { params: Promise.resolve(matched.params) });
    };
    return {
        GET: handle("GET"),
        POST: handle("POST"),
        PATCH: handle("PATCH"),
        PUT: handle("PUT"),
        DELETE: handle("DELETE"),
    };
}
