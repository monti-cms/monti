import { CmsError } from "../../../adapters/postgres/store/errors.js";
import { getCmsContentStore } from "../../../container.js";
import { isCollection, isItemCollection } from "../../../core/collections.js";
import { DEFAULT_LOCALE, isLocale } from "../../../core/locales.js";
import { getEntry, listEntries } from "../../../read/index.js";
import { storedField } from "../../../schema/derive.js";
import { cmsServerConfig } from "../../../server/resolved.js";
import { defaultPublicJson } from "./options.js";
import { publicApiError, publicError, publicJson } from "./respond.js";
const options = () => cmsServerConfig.publicApi;
const localeOf = (value) => {
    if (value === null)
        return DEFAULT_LOCALE;
    if (!isLocale(value))
        throw new CmsError("Invalid locale", "invalid_input");
    return value;
};
const toJson = (config) => config.toJson ?? defaultPublicJson;
/** Address of the entry a relation field points to → translation group ID. An unknown address yields `null` (empty list). */
async function targetId(collection, field, slug) {
    const stored = isCollection(collection) ? storedField(collection, field) : undefined;
    if (stored?.field.kind !== "relation")
        throw new Error(`publicApi.filters: ${field} is not a relation field`);
    const target = stored.field.to;
    const found = await getCmsContentStore().getPublishedEntryBySlug({
        collection: target,
        slug,
        locale: DEFAULT_LOCALE,
        includeBody: false,
    });
    return found.status === "not_found" ? null : found.entry.translationGroupId;
}
/** `GET /api/cms/v1/public/entries?collection&page&pageSize&locale&<filters>` — published list (newest publish date first). */
export async function GET(request) {
    const config = options();
    if (!config)
        return publicError("not_found", "Not found");
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
        const where = {};
        for (const [name, field] of Object.entries(config.filters ?? {})) {
            const value = params.get(name);
            if (value === null)
                continue;
            if (!value.trim())
                return publicError("invalid_input", "Invalid query parameters");
            // Skip conditions for fields this collection does not have (e.g. memos have no category).
            if (!storedField(collection, field))
                continue;
            const id = await targetId(collection, field, value);
            if (!id)
                return publicJson({ items: [], total: 0, page, pageSize });
            where[field] = id;
        }
        const locale = isItemCollection(collection) ? DEFAULT_LOCALE : localeOf(params.get("locale"));
        const result = await listEntries({ collection, locale, where, page, pageSize, sort: "publishedAt" });
        const items = result.items.map((entry) => toJson(config)(entry, { body: false })).filter((item) => item !== null);
        return publicJson({ ...result, items });
    }
    catch (error) {
        return publicApiError(error);
    }
}
/** `GET /api/cms/v1/public/entries/:collection/:slug?locale` — a single published entry. For an old address, reports the canonical address as `address`. */
export async function getOne(request, params) {
    const config = options();
    if (!config)
        return publicError("not_found", "Not found");
    try {
        const { collection, slug } = params;
        if (!config.collections.includes(collection) || !isCollection(collection)) {
            return publicError("invalid_input", `Unsupported collection: ${collection}`);
        }
        if (!slug.trim())
            return publicError("invalid_input", "slug is required");
        const result = await getEntry({ collection, slug, locale: localeOf(request.nextUrl.searchParams.get("locale")) });
        if (result.status === "not_found")
            return publicError("not_found", "Not found");
        const entry = toJson(config)(result.entry, { body: true });
        if (entry === null)
            return publicError("not_found", "Not found");
        return publicJson({
            entry,
            address: { slug: result.entry.slug, isAlias: result.status === "redirect" },
        });
    }
    catch (error) {
        return publicApiError(error);
    }
}
