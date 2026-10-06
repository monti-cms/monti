import type { Cms } from "../../../cms";
import { isCollection, isItemCollection } from "../../../core/collections";
import { DEFAULT_LOCALE, isLocale } from "../../../core/locales";
import { CmsError } from "../../../core/store";
import { storedField } from "../../../schema/derive";
import { defaultPublicJson, type PublicApiOptions } from "./options";
import { publicApiError, publicError, publicJson } from "./respond";

const localeOf = (value: string | null) => {
	if (value === null) return DEFAULT_LOCALE;
	if (!isLocale(value)) throw new CmsError("Invalid locale", "invalid_input");
	return value;
};

const toJson = (config: PublicApiOptions) => config.toJson ?? defaultPublicJson;

/** Address of the entry a relation field points to → translation group ID. An unknown address yields `null` (empty list). */
async function targetId(cms: Cms, collection: string, field: string, slug: string): Promise<string | null> {
	const stored = isCollection(collection) ? storedField(collection, field) : undefined;
	if (stored?.field.kind !== "relation") throw new Error(`publicApi.filters: ${field} is not a relation field`);
	const target = stored.field.to;
	const found = await cms.store().getPublishedEntryBySlug({
		collection: target,
		slug,
		locale: DEFAULT_LOCALE,
		includeBody: false,
	});
	return found.status === "not_found" ? null : found.entry.translationGroupId;
}

/** `GET /api/cms/v1/public/entries?collection&page&pageSize&locale&<filters>` — published list (newest publish date first). */
export async function GET(request: Request, { cms }: { cms: Cms }): Promise<Response> {
	const config: PublicApiOptions | undefined = cms.server.publicApi;
	if (!config) return publicError("not_found", "Not found");
	try {
		const params = new URL(request.url).searchParams;
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
			// Skip conditions for fields this collection does not have (a filter names a relation only some collections have).
			if (!storedField(collection, field)) continue;
			const id = await targetId(cms, collection, field, value);
			if (!id) return publicJson({ items: [], total: 0, page, pageSize });
			where[field] = id;
		}
		const locale = isItemCollection(collection) ? DEFAULT_LOCALE : localeOf(params.get("locale"));
		const result = await cms.read.listEntries({ collection, locale, where, page, pageSize, sort: "publishedAt" });
		const items = result.items.map((entry) => toJson(config)(entry, { body: false })).filter((item) => item !== null);
		return publicJson({ ...result, items });
	} catch (error) {
		return publicApiError(error);
	}
}

/** `GET /api/cms/v1/public/entries/:collection/:slug?locale` — a single published entry. For an old address, reports the canonical address as `address`. */
export async function getOne(
	request: Request,
	params: { collection: string; slug: string },
	cms: Cms,
): Promise<Response> {
	const config: PublicApiOptions | undefined = cms.server.publicApi;
	if (!config) return publicError("not_found", "Not found");
	try {
		const { collection, slug } = params;
		if (!config.collections.includes(collection) || !isCollection(collection)) {
			return publicError("invalid_input", `Unsupported collection: ${collection}`);
		}
		if (!slug.trim()) return publicError("invalid_input", "slug is required");
		const format = new URL(request.url).searchParams.get("format") || undefined;
		const result = await cms.read.getEntry({
			collection,
			slug,
			locale: localeOf(new URL(request.url).searchParams.get("locale")),
			...(format ? { format } : {}),
		});
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
