import { authGateway } from "../../adapters/auth/index.js";
import { HttpError, handleApiError } from "./error-handler.js";
import { validateSameOrigin } from "./security.js";
export function adminRoute(handler) {
    return async (request, context) => {
        try {
            validateSameOrigin(request);
            const auth = await authGateway.verifyAdmin();
            const params = (await context?.params) ?? {};
            return await handler({ request, params, auth });
        }
        catch (error) {
            return handleApiError(error);
        }
    };
}
/** Reads the JSON body. 400 if malformed. A missing body is treated as `{}`. */
export async function readJsonBody(request) {
    const text = await request.text();
    if (!text.trim())
        return {};
    try {
        return JSON.parse(text);
    }
    catch {
        throw new HttpError(400, "invalid_input", "Request body is not valid JSON");
    }
}
/**
 * Change requests need the `version` from the read response. 428 if missing, and the store throws 409 if it differs from the server.
 * A missing version is rejected before a malformed body (400).
 */
export function assertVersionPresent(value) {
    if (value === undefined || value === null || value === "") {
        throw new HttpError(428, "version_required", "expectedVersion is required");
    }
}
export function parseWith(schema, value, message = "Invalid request body") {
    const parsed = schema.safeParse(value);
    if (!parsed.success)
        throw new HttpError(400, "invalid_input", message, parsed.error.issues);
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
    const raw = request.nextUrl.searchParams.get("expectedVersion");
    assertVersionPresent(raw ?? undefined);
    const version = Number(raw);
    if (!Number.isInteger(version) || version <= 0) {
        throw new HttpError(400, "invalid_input", "Invalid expectedVersion");
    }
    return version;
}
/** Converts the query to an object. Keys in `arrayKeys` may appear multiple times. */
export function readQuery(request, arrayKeys = []) {
    const query = {};
    const params = request.nextUrl.searchParams;
    for (const key of new Set(params.keys())) {
        query[key] = arrayKeys.includes(key) ? params.getAll(key) : params.get(key);
    }
    return query;
}
export const json = (body, init) => Response.json(body, init);
