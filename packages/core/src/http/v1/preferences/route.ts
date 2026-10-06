import { type PreferencesBody, preferencesBodySchema } from "../../../core/api";
import { COLLECTIONS } from "../../../core/collections";
import type { JsonObject } from "../../../core/store";
import { adminRoute, json, parseWith, readJsonBody } from "../handler";

/** Normalizes stored preferences to the per-collection shape. Unknown or corrupt values (including the removed global page size and sort) are dropped. */
function normalize(stored: PreferencesBody | null): PreferencesBody {
	const collections: Record<string, unknown> = {};
	for (const collection of COLLECTIONS) {
		collections[collection] = { ...(stored?.collections?.[collection] ?? {}) };
	}
	const parsed = preferencesBodySchema.safeParse({ collections, editor: stored?.editor });
	return parsed.success ? parsed.data : {};
}

export const GET = adminRoute(async ({ auth, cms }) => {
	const stored = await cms.store().getPreferences({ userId: auth.userId });
	return json(normalize(stored as PreferencesBody | null));
});

/** Merges and saves per collection. Collections and keys not sent are kept. */
export const PUT = adminRoute(async ({ request, auth, cms }) => {
	const body = parseWith(preferencesBodySchema, await readJsonBody(request), "Invalid preferences body");
	const store = cms.store();
	const current = normalize((await store.getPreferences({ userId: auth.userId })) as PreferencesBody | null);
	const collections = { ...current.collections };
	for (const [collection, value] of Object.entries(body.collections ?? {})) {
		const key = collection as keyof NonNullable<PreferencesBody["collections"]>;
		collections[key] = { ...collections[key], ...value };
	}
	const preferences: PreferencesBody = { collections, editor: { ...current.editor, ...body.editor } };
	await store.savePreferences({ userId: auth.userId, preferences: preferences as JsonObject });
	return json({ success: true, preferences });
});
