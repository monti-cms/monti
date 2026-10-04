import type { JsonObject } from "../../../adapters/postgres/content-store";
import { getCmsContentStore } from "../../../container";
import { type PreferencesBody, preferencesBodySchema } from "../../../core/api";
import { COLLECTIONS } from "../../../core/collections";
import { adminRoute, json, parseWith, readJsonBody } from "../handler";

type StoredPreferences = PreferencesBody & {
	// Previous storage shape (global page size and sort, per-collection columns). Migrated to the new shape on read.
	defaultPageSize?: unknown;
	sort?: unknown;
	columnSettings?: Record<string, unknown>;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** Normalizes stored preferences to the per-collection shape. Unknown or corrupt values are dropped. */
function normalize(stored: StoredPreferences | null): PreferencesBody {
	const collections: Record<string, unknown> = {};
	for (const collection of COLLECTIONS) {
		const legacy = {
			...(isObject(stored?.columnSettings?.[collection]) ? { columns: stored?.columnSettings?.[collection] } : {}),
			...(stored?.defaultPageSize ? { pageSize: stored.defaultPageSize } : {}),
			...(isObject(stored?.sort) ? { sort: stored.sort } : {}),
		};
		collections[collection] = { ...legacy, ...(stored?.collections?.[collection] ?? {}) };
	}
	const parsed = preferencesBodySchema.safeParse({ collections, editor: stored?.editor });
	return parsed.success ? parsed.data : {};
}

export const GET = adminRoute(async ({ auth }) => {
	const stored = await getCmsContentStore().getPreferences({ userId: auth.userId });
	return json(normalize(stored as StoredPreferences | null));
});

/** Merges and saves per collection. Collections and keys not sent are kept. */
export const PUT = adminRoute(async ({ request, auth }) => {
	const body = parseWith(preferencesBodySchema, await readJsonBody(request), "Invalid preferences body");
	const store = getCmsContentStore();
	const current = normalize((await store.getPreferences({ userId: auth.userId })) as StoredPreferences | null);
	const collections = { ...current.collections };
	for (const [collection, value] of Object.entries(body.collections ?? {})) {
		const key = collection as keyof NonNullable<PreferencesBody["collections"]>;
		collections[key] = { ...collections[key], ...value };
	}
	const preferences: PreferencesBody = { collections, editor: { ...current.editor, ...body.editor } };
	await store.savePreferences({ userId: auth.userId, preferences: preferences as JsonObject });
	return json({ success: true, preferences });
});
