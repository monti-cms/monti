import { patchApiKeyBodySchema } from "../../../../core/api-keys";
import { CmsError } from "../../../../core/store";
import { adminRoute, json, readVersionedBody, readVersionQuery } from "../../handler";

type IdParams = { id: string };

/** Renames a key, replaces its value, or both. Everything that uses the key keeps using it (it is the same key). */
export const PATCH = adminRoute<IdParams>(async ({ request, params, cms }) => {
	const { expectedVersion, name, value } = await readVersionedBody(request, patchApiKeyBodySchema);
	return json(
		await cms.apiKeys.update(params.id, {
			expectedVersion,
			...(name === undefined ? {} : { name }),
			...(value === undefined ? {} : { value }),
		}),
	);
});

/**
 * Deletes a key. A key that something uses is not deleted unless the request says `?force=true`: without it the answer is 409 `key_in_use` with the
 * places that would stop working (`details.uses`), so the admin can show them and ask again.
 */
export const DELETE = adminRoute<IdParams>(async ({ request, params, cms }) => {
	const expectedVersion = readVersionQuery(request);
	const key = await cms.apiKeys.get(params.id);
	if (!key) throw new CmsError("Key not found", "not_found");
	if (key.uses.length > 0 && new URL(request.url).searchParams.get("force") !== "true") {
		throw new CmsError(
			`${key.uses.length} place${key.uses.length === 1 ? "" : "s"} use this key and would stop working`,
			"key_in_use",
			key.version,
			{ uses: key.uses },
		);
	}
	await cms.apiKeys.remove(params.id, { expectedVersion });
	return json({ ok: true });
});
