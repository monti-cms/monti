import type { NextRequest } from "next/server";
import { CmsError } from "../../../adapters/postgres/store/errors";
import { getCmsContentStore } from "../../../container";
import { isCollection, isItemCollection } from "../../../core/collections";
import { DEFAULT_LOCALE, isLocale } from "../../../core/locales";
import { getEntry, listEntries } from "../../../read";
import { storedField } from "../../../schema/derive";
import type { CmsServerConfig } from "../../../server/define";
import { cmsServerConfig } from "../../../server/resolved";
import { defaultPublicJson, type PublicApiOptions } from "./options";
import { publicApiError, publicError, publicJson } from "./respond";

const options = (): PublicApiOptions | undefined => (cmsServerConfig as CmsServerConfig).publicApi;

const localeOf = (value: string | null) => {
	if (value === null) return DEFAULT_LOCALE;
	if (!isLocale(value)) throw new CmsError("Invalid locale", "invalid_input");
	return value;
};

const toJson = (config: PublicApiOptions) => config.toJson ?? defaultPublicJson;

/** 관계 필드가 가리키는 대상 항목의 주소 → 번역 묶음 ID. 없는 주소면 `null`(빈 목록). */
async function targetId(collection: string, field: string, slug: string): Promise<string | null> {
	const stored = isCollection(collection) ? storedField(collection, field) : undefined;
	if (stored?.field.kind !== "relation") throw new Error(`publicApi.filters: ${field} is not a relation field`);
	const target = stored.field.to;
	const found = await getCmsContentStore().getPublishedEntryBySlug({
		collection: target,
		slug,
		locale: DEFAULT_LOCALE,
		includeBody: false,
	});
	return found.status === "not_found" ? null : found.entry.translationGroupId;
}

/** `GET /api/cms/v1/public/entries?collection&page&pageSize&locale&<filters>` — 공개본 목록(발행일 최신순). */
export async function GET(request: NextRequest): Promise<Response> {
	const config = options();
	if (!config) return publicError("not_found", "Not found");
	try {
		const params = request.nextUrl.searchParams;
		const collection = params.get("collection") ?? config.defaultCollection ?? config.collections[0];
		if (!collection || !config.collections.includes(collection) || !isCollection(collection)) {
			return publicError("invalid_input", "Invalid query parameters");
		}
		const max = config.maxPageSize ?? 100;
		const page = Number(params.get("page") ?? 1);
		const pageSize = Number(params.get("pageSize") ?? 25);
		if (!Number.isInteger(page) || page < 1 || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > max) {
			return publicError("invalid_input", "Invalid query parameters");
		}
		const where: Record<string, string> = {};
		for (const [name, field] of Object.entries(config.filters ?? {})) {
			const value = params.get(name);
			if (value === null) continue;
			if (!value.trim()) return publicError("invalid_input", "Invalid query parameters");
			// 이 컬렉션에 없는 필드의 조건은 건너뛴다(예: 메모에는 카테고리가 없다).
			if (!storedField(collection, field)) continue;
			const id = await targetId(collection, field, value);
			if (!id) return publicJson({ items: [], total: 0, page, pageSize });
			where[field] = id;
		}
		const locale = isItemCollection(collection) ? DEFAULT_LOCALE : localeOf(params.get("locale"));
		const result = await listEntries({ collection, locale, where, page, pageSize, sort: "publishedAt" });
		const items = result.items.map((entry) => toJson(config)(entry, { body: false })).filter((item) => item !== null);
		return publicJson({ ...result, items });
	} catch (error) {
		return publicApiError(error);
	}
}

/** `GET /api/cms/v1/public/entries/:collection/:slug?locale` — 공개본 단건. 옛 주소면 정규 주소를 `address`로 알린다. */
export async function getOne(request: NextRequest, params: { collection: string; slug: string }): Promise<Response> {
	const config = options();
	if (!config) return publicError("not_found", "Not found");
	try {
		const { collection, slug } = params;
		if (!config.collections.includes(collection) || !isCollection(collection)) {
			return publicError("invalid_input", `Unsupported collection: ${collection}`);
		}
		if (!slug.trim()) return publicError("invalid_input", "slug is required");
		const result = await getEntry({ collection, slug, locale: localeOf(request.nextUrl.searchParams.get("locale")) });
		if (result.status === "not_found") return publicError("not_found", "Not found");
		const entry = toJson(config)(result.entry, { body: true });
		if (entry === null) return publicError("not_found", "Not found");
		return publicJson({
			entry,
			address: { slug: result.entry.slug, isAlias: result.status === "redirect" },
		});
	} catch (error) {
		return publicApiError(error);
	}
}
