import { hostOf } from "../../cms/host.js";
import { actorOf, withActor } from "../../core/actor.js";
import { isUuid } from "../../core/ids.js";
import { tellIssues } from "../../core/issue-text.js";
import { MAX_FORM_BYTES, MAX_REQUEST_BYTES } from "../../core/limits.js";
import { CmsError, deleted, handleApiError, ok } from "./error-handler.js";
import { validateSameOrigin } from "./security.js";
export const bearerTokenOf = (request) => /^Bearer\s+(.+)$/i.exec(request.headers.get("authorization") ?? "")?.[1] ?? null;
/** Runs the handler of an admin request: the same-origin check, the admin check, the `[id]` shape, and the actor for the change record. */
async function guardedAdmin(cms, request, params, run, options = {}) {
    validateSameOrigin(hostOf(cms), request, options);
    const auth = await hostOf(cms).authGateway.verifyAdmin();
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
export async function runAdminRoute(cms, request, params, handler, plugin, options = {}) {
    try {
        return await guardedAdmin(cms, request, params, (auth) => handler({ request, params, auth, cms, plugin: plugin }), options);
    }
    catch (error) {
        return handleApiError(error, cms.site);
    }
}
/**
 * Runs a route of the given access kind (see {@link RouteAccess}): the guard of the kind, then the handler. Errors become the one error answer. A login connection may redirect
 * by throwing (Next.js does); that signal must reach the host framework, so a route that needs no login offers the error to the connection first.
 */
export async function runRoute(cms, request, params, handler, access = "admin", 
/** The plugin that owns the route. A core route has none, and its handler never reads `plugin`. */
plugin) {
    if (access === "admin" || access === "admin-upload") {
        return runAdminRoute(cms, request, params, handler, plugin, {
            upload: access === "admin-upload",
        });
    }
    const owner = plugin;
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
                validateSameOrigin(hostOf(cms), request, { form: true });
                break;
            case "admin-or-bearer":
                if (bearerTokenOf(request) === null) {
                    return await guardedAdmin(cms, request, params, (auth) => handler({ request, params, auth, cms, plugin: owner }));
                }
                return await handler({ request, params, auth: null, cms, plugin: owner });
            case "signed":
                break;
        }
        return await handler({ request, params, cms, plugin: owner });
    }
    catch (error) {
        if (access === "admin-or-bearer")
            return handleApiError(error, cms.site);
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
 * export const GET = adminRoute(async ({ request, params, auth, cms, plugin }) => ok(await plugin.storage.collection("items").list()));
 * ```
 */
export const adminRoute = (handler) => handler;
/** Declares the handler of a route of access `public-read`, `same-origin-form` or `signed`: it gets no login, because the router's guard of the kind has run (a `signed` route verifies the request itself). */
export const publicRoute = (handler) => handler;
/** Declares the handler of an `admin-or-bearer` route. A request with no `auth` carries a bearer token (`bearerTokenOf`) that the handler must verify. */
export const bearerRoute = (handler) => handler;
const tooLarge = (maxBytes) => new CmsError(`Request body exceeds ${maxBytes} bytes`, "payload_too_large");
/**
 * Reads the raw body, at most `maxBytes` of it. A declared `Content-Length` over the cap is refused before a byte is read; a body that does not declare one
 * (chunked) is read as a stream, counted, and cancelled the moment it passes the cap. `Content-Length` alone is not trusted: it can be missing or wrong.
 * 413 when over. Public routes use this too, so nothing is read unbounded before login or before a signature check.
 */
export async function readBodyBytes(request, maxBytes = MAX_REQUEST_BYTES) {
    const declared = Number(request.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > maxBytes)
        throw tooLarge(maxBytes);
    if (!request.body)
        return new Uint8Array();
    const reader = request.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done)
            break;
        total += value.byteLength;
        if (total > maxBytes) {
            await reader.cancel().catch(() => { });
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
export async function readBodyText(request, maxBytes = MAX_REQUEST_BYTES) {
    return new TextDecoder().decode(await readBodyBytes(request, maxBytes));
}
/** Reads a form post (urlencoded or multipart), at most `maxBytes` of it. The size is checked before the form is parsed. */
export async function readFormBody(request, maxBytes = MAX_FORM_BYTES) {
    const bytes = await readBodyBytes(request, maxBytes);
    const contentType = request.headers.get("content-type");
    try {
        return await new Response(new Blob([bytes]), {
            headers: contentType ? { "content-type": contentType } : {},
        }).formData();
    }
    catch {
        throw new CmsError("Request body is not a valid form", "invalid_input");
    }
}
/** Reads the JSON body, at most `MAX_REQUEST_BYTES`. 413 if larger, 400 if malformed. A missing body is treated as `{}`. */
export async function readJsonBody(request) {
    const text = await readBodyText(request);
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
        throw new CmsError(message, "invalid_input", { issues: parsed.error.issues });
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
/** The translation group of an entry (the languages the editor shows as existing). Empty for an item collection, which has no translations. */
export async function translationsOf(cms, entry) {
    if (cms.site.isItemCollection(entry.collection))
        return [];
    return (await cms.store().getTranslationGroup({ entryId: entry.id })).members;
}
/**
 * The answer to a write of the content service: the entry with its translation group (the same list a read returns, so the editor needs no second request to
 * show a language the write just created), and its warnings with their person's text (`text`, `where`) in the admin language.
 */
export const written = async (cms, result, init) => ok({
    ...result,
    entry: { ...result.entry, translations: await translationsOf(cms, result.entry) },
    warnings: tellIssues(cms.site, result.warnings),
}, init);
/** The answer to a bulk operation: every item's warnings or issues with their person's text. */
export const bulkWritten = (cms, result) => ok({
    results: result.results.map((item) => item.ok
        ? item.warnings
            ? { ...item, warnings: tellIssues(cms.site, item.warnings) }
            : item
        : item.issues
            ? { ...item, issues: tellIssues(cms.site, item.issues) }
            : item),
});
export { CmsError, deleted, ok };
