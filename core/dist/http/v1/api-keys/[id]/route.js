import { patchApiKeyBodySchema } from "../../../../core/api-keys.js";
import { adminRoute, deleted, ok, readVersionedBody, readVersionQuery } from "../../handler.js";
/** Renames a key, replaces its value, or both. Everything that uses the key keeps using it (it is the same key). */
export const PATCH = adminRoute(async ({ request, params, cms }) => {
    const { expectedVersion, name, value } = await readVersionedBody(request, patchApiKeyBodySchema);
    return ok(await cms.apiKeys.update(params.id, {
        expectedVersion,
        ...(name === undefined ? {} : { name }),
        ...(value === undefined ? {} : { value }),
    }));
});
/**
 * Deletes a key. A key that something uses is not deleted unless the request says `?force=true`: without it the answer is 409 `key_in_use` with the
 * places that would stop working (`details.uses`), so the admin can show them and ask again.
 */
export const DELETE = adminRoute(async ({ request, params, cms }) => {
    await cms.apiKeys.remove(params.id, {
        expectedVersion: readVersionQuery(request),
        force: new URL(request.url).searchParams.get("force") === "true",
    });
    return deleted();
});
