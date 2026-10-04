import type { JsonObject } from "../../../adapters/postgres/content-store";
import { getCmsContentStore } from "../../../container";
import { type PreferencesBody, preferencesBodySchema } from "../../../core/api";
import { COLLECTIONS } from "../../../core/collections";
import { adminRoute, json, parseWith, readJsonBody } from "../handler";

type StoredPreferences = PreferencesBody & {
	// 이전 저장 모양(전역 페이지 크기·정렬, 컬렉션별 컬럼). 읽을 때 새 모양으로 옮긴다.
	defaultPageSize?: unknown;
	sort?: unknown;
	columnSettings?: Record<string, unknown>;
};

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

/** 저장된 설정을 컬렉션별 모양으로 맞춘다. 알 수 없거나 깨진 값은 버린다. */
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

/** 컬렉션 단위로 병합해 저장한다. 보내지 않은 컬렉션·키는 유지한다. */
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
