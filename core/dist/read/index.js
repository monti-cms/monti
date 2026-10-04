/**
 * Public site reading (`@monti-cms/core/read`). Server components, routes, sitemap and RSS read the published content. No write features.
 * Do not import from browser code.
 *
 * - One entry (`getEntry`): returns the URL to redirect to for an old URL, and can fall back to the source text if this locale has no translation.
 * - List (`listEntries`): relation filters, sorting and pagination are done in the DB.
 * - Translations (`getTranslations`): the published locales of the same entry and their URLs (hreflang).
 * - Preview (`getPreview`): admins only, the latest draft.
 * - Relations are resolved to the target's published version, with title and URL attached (this locale, else the source text).
 */
import { authGateway } from "../adapters/auth/index.js";
import { getCmsContentStore } from "../container.js";
import { isCollection, isItemCollection } from "../core/collections.js";
import { contentPath } from "../core/links.js";
import { DEFAULT_LOCALE, isLocale, localizePath } from "../core/locales.js";
import { mergeTranslationMetadata, RECORD_TRANSLATIONS_KEY, recordLocalizedFields, storedFields, } from "../schema/derive.js";
const relationFieldsOf = (collection) => storedFields(collection).filter((stored) => stored.field.kind === "relation");
const idsOf = (value) => typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
const titleOf = (record, locale) => {
    const metadata = record.metadata;
    if (isCollection(record.collection) && recordLocalizedFields(record.collection).includes("title")) {
        const translations = metadata[RECORD_TRANSLATIONS_KEY];
        const localized = translations?.[locale]?.title;
        if (typeof localized === "string" && localized.trim())
            return localized;
    }
    return typeof metadata.title === "string" ? metadata.title : null;
};
const pathOf = (collection, slug, locale) => {
    const path = contentPath(collection, slug);
    return path ? localizePath(locale, path) : null;
};
/** Gathers the published versions of relation targets (in one query) and picks this locale -> source text. */
async function resolveRelations(records, locale) {
    const wanted = new Set();
    for (const record of records) {
        if (!isCollection(record.collection))
            continue;
        for (const { name } of relationFieldsOf(record.collection)) {
            for (const id of idsOf(record.metadata[name]))
                wanted.add(id);
        }
    }
    const targets = await getCmsContentStore().listPublishedByGroups({ translationGroupIds: [...wanted] });
    const byGroup = new Map();
    for (const target of targets)
        byGroup.set(target.translationGroupId, [...(byGroup.get(target.translationGroupId) ?? []), target]);
    const pick = (groupId) => {
        const members = byGroup.get(groupId);
        if (!members)
            return null;
        const chosen = members.find((member) => member.locale === locale) ??
            members.find((member) => member.id === member.translationGroupId) ??
            members[0];
        if (!chosen)
            return null;
        return {
            id: chosen.translationGroupId,
            collection: chosen.collection,
            locale: chosen.locale,
            slug: chosen.slug,
            title: titleOf(chosen, locale),
            path: pathOf(chosen.collection, chosen.slug, chosen.locale),
        };
    };
    const result = new Map();
    for (const record of records) {
        const relations = {};
        if (isCollection(record.collection)) {
            for (const { name } of relationFieldsOf(record.collection)) {
                relations[name] = idsOf(record.metadata[name])
                    .map(pick)
                    .filter((relation) => relation !== null);
            }
        }
        result.set(record.id, relations);
    }
    return result;
}
async function toReadEntries(records, locale, fallback = false) {
    const relations = await resolveRelations(records, locale);
    return records.map((record) => ({
        id: record.id,
        collection: record.collection,
        locale: record.locale,
        translationGroupId: record.translationGroupId,
        slug: record.slug,
        path: pathOf(record.collection, record.slug, record.locale),
        title: titleOf(record, locale),
        metadata: record.metadata,
        relations: relations.get(record.id) ?? {},
        publishedAt: record.publishedAt,
        updatedAt: record.updatedAt,
        mdx: record.mdx,
        fallback,
    }));
}
const assertCollection = (collection) => {
    if (!isCollection(collection))
        throw new Error(`cms/read: unknown collection "${collection}"`);
    return collection;
};
/** An item collection has only the default locale (the name is picked from the per-locale values). */
const storageLocale = (collection, locale) => isItemCollection(collection) ? DEFAULT_LOCALE : locale && isLocale(locale) ? locale : DEFAULT_LOCALE;
/**
 * One entry. The URL (`slug`) is that locale's URL. For an old URL it returns `redirect`.
 * With `fallback: true`, if this locale has no translation, it returns the source text (default locale) at the same URL with `fallback: true`.
 */
export async function getEntry(params) {
    const collection = assertCollection(params.collection);
    const locale = storageLocale(collection, params.locale);
    const slug = params.slug.normalize("NFC").trim();
    if (!slug)
        return { status: "not_found" };
    const store = getCmsContentStore();
    let lookup = await store.getPublishedEntryBySlug({ collection, slug, locale, includeBody: true });
    let fellBack = false;
    if (lookup.status === "not_found" && params.fallback && locale !== DEFAULT_LOCALE) {
        lookup = await store.getPublishedEntryBySlug({ collection, slug, locale: DEFAULT_LOCALE, includeBody: true });
        fellBack = lookup.status !== "not_found";
    }
    if (lookup.status === "not_found")
        return { status: "not_found" };
    const [entry] = await toReadEntries([lookup.entry], params.locale ?? locale, fellBack);
    if (!entry)
        return { status: "not_found" };
    if (lookup.status === "alias")
        return { status: "redirect", slug: entry.slug, path: entry.path, entry };
    return { status: "found", entry };
}
/** One page of a list. Relation filters (`where`), sorting and pagination are done in the DB. The body is read only when `body: true`. */
export async function listEntries(params) {
    const collection = assertCollection(params.collection);
    const locale = storageLocale(collection, params.locale);
    const result = await getCmsContentStore().listPublishedPage({
        collection,
        locale,
        where: params.where,
        sort: params.sort,
        // For item collections, title sorting uses the displayed name (the translated name in this locale).
        titleLocale: params.locale ?? locale,
        order: params.order,
        page: params.page,
        pageSize: params.pageSize,
        includeBody: params.body === true,
    });
    return { ...result, items: await toReadEntries(result.items, params.locale ?? locale) };
}
/** The published locales of the same entry (source first) and their URLs. Used for hreflang and the locale switcher. */
export async function getTranslations(params) {
    const members = await getCmsContentStore().listPublishedTranslations(params);
    return members.map((member) => ({
        locale: member.locale,
        slug: member.slug,
        path: pathOf(member.collection, member.slug, member.locale),
    }));
}
/**
 * Preview (admins only). Returns the latest draft in the same shape as the published version. A translation is merged with the common values of the source draft.
 * `null` if not logged in or not an admin. Only published relation targets are resolved.
 */
export async function getPreview(params) {
    try {
        await authGateway.verifyAdmin();
    }
    catch {
        return null;
    }
    const collection = assertCollection(params.collection);
    const locale = storageLocale(collection, params.locale);
    const store = getCmsContentStore();
    const draft = await store.getWorkingEntryBySlug({ collection, slug: params.slug, locale });
    if (!draft || draft.status === "trashed")
        return null;
    let metadata = draft.working.metadata;
    if (draft.translationGroupId !== draft.id) {
        const source = await store.getEntry(draft.translationGroupId).catch(() => null);
        if (source)
            metadata = mergeTranslationMetadata(collection, source.working.metadata, metadata);
    }
    const record = {
        id: draft.id,
        collection,
        locale: draft.locale,
        translationGroupId: draft.translationGroupId,
        slug: draft.workingSlug ?? params.slug,
        metadata,
        mdx: draft.working.mdx,
        publishedAt: draft.publishedAt ?? null,
        updatedAt: draft.updatedAt,
    };
    const [entry] = await toReadEntries([record], locale);
    return entry ?? null;
}
