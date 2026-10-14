import { actorOf, withActor } from "../../core/actor.js";
import { isUuid } from "../../core/ids.js";
import { CmsError, deleted, handleApiError, ok } from "./error-handler.js";
import { validateSameOrigin } from "./security.js";
/**
 * Runs an admin route: the same-origin check of a state-changing request, the admin check, the `[id]` shape, and the actor for the change record. Errors become the
 * one error answer. The router does this for every route that is not `public`, so a handler holds no auth code.
 */
export async function runAdminRoute(cms, request, params, handler) {
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
    }
    catch (error) {
        return handleApiError(error);
    }
}
/**
 * Runs a public route: errors become the one error answer. A login connection may redirect by throwing (Next.js does); that signal must reach the host framework,
 * so it is offered to the connection first.
 */
export async function runPublicRoute(cms, request, params, handler) {
    try {
        return await handler({ request, params, cms });
    }
    catch (error) {
        let auth;
        try {
            auth = cms.auth();
        }
        catch {
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
export const adminRoute = (handler) => handler;
/** Declares the handler of a `public: true` route. It needs no login and checks the request itself. */
export const publicRoute = (handler) => handler;
/** Reads the JSON body. 400 if malformed. A missing body is treated as `{}`. */
export async function readJsonBody(request) {
    const text = await request.text();
    if (!text.trim())
        return {};
    try {
        return JSON.parse(text);
    }
    catch {
        throw new CmsError("Request body is not valid JSON", "invalid_input");
    }
}
/**
 * Change requests need the `version` from the read response. 428 if missing, and the store throws 409 if it differs from the server.
 * A missing version is rejected before a malformed body (400).
 */
export function assertVersionPresent(value) {
    if (value === undefined || value === null || value === "") {
        throw new CmsError("expectedVersion is required", "version_required");
    }
}
export function parseWith(schema, value, message = "Invalid request body") {
    const parsed = schema.safeParse(value);
    if (!parsed.success)
        throw new CmsError(message, "invalid_input", undefined, undefined, parsed.error.issues);
    return parsed.data;
}
/** Reads the body, checks that a version is present, then validates it against the schema. */
export async function readVersionedBody(request, schema) {
    const body = await readJsonBody(request);
    assertVersionPresent(body?.expectedVersion);
    return parseWith(schema, body);
}
/** The `expectedVersion` query param (DELETE requests). */
export function readVersionQuery(request) {
    const raw = new URL(request.url).searchParams.get("expectedVersion");
    assertVersionPresent(raw ?? undefined);
    const version = Number(raw);
    if (!Number.isInteger(version) || version <= 0) {
        throw new CmsError("Invalid expectedVersion", "invalid_input");
    }
    return version;
}
/** Converts the query to an object. Keys in `arrayKeys` may appear multiple times. */
export function readQuery(request, arrayKeys = []) {
    const query = {};
    const params = new URL(request.url).searchParams;
    for (const key of new Set(params.keys())) {
        query[key] = arrayKeys.includes(key) ? params.getAll(key) : params.get(key);
    }
    return query;
}
/** The `format` query param of a read, or `undefined`. An invalid name is a 400; whether the format is installed is decided where it is used. */
export function readFormatQuery(request) {
    const raw = new URL(request.url).searchParams.get("format");
    if (raw === null || raw === "")
        return undefined;
    if (!/^[a-z][a-z0-9-]*$/.test(raw))
        throw new CmsError("Invalid format", "invalid_input");
    return raw;
}
export { deleted, ok };
