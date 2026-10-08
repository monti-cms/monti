import { collectRefs, EMPTY_REFS } from "../doc/document-refs.js";
import { resolvePublicMedia, resolvePublicMediaUrl } from "../doc/public-media.js";
import { exportText } from "../format/convert.js";
import { unknownFormatError } from "../format/unknown.js";
import { RECORD_TRANSLATIONS_KEY } from "../schema/derive.js";
const relationFieldsOf = (site, collection) => site.storedFields(collection).filter((stored) => stored.field.kind === "relation");
const idsOf = (value) => typeof value === "string" ? [value] : Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
const titleOf = (site, record, locale) => {
    if (!site.isCollection(record.collection))
        return null;
    const metadata = record.metadata;
    const { name } = site.titleField(record.collection);
    if (site.recordLocalizedFields(record.collection).includes(name)) {
        const translations = metadata[RECORD_TRANSLATIONS_KEY];
        const localized = translations?.[locale]?.[name];
        if (typeof localized === "string" && localized.trim())
            return localized;
    }
    return site.titleOfValues(record.collection, metadata);
};
const pathOf = (site, collection, slug, locale) => {
    const path = site.contentPath(collection, slug);
    return path ? site.localizePath(locale, path) : null;
};
/**
 * The published version of each entry (translation group) id for a reader: the one in `locale`, else the source text, else any language.
 * One query for all ids; an id with no published version has no result.
 */
async function publishedPicker(store, groupIds, locale) {
    const wanted = [...new Set(groupIds)];
    const targets = wanted.length > 0 ? await store.listPublishedByGroups({ translationGroupIds: wanted }) : [];
    const byGroup = new Map();
    for (const target of targets)
        byGroup.set(target.translationGroupId, [...(byGroup.get(target.translationGroupId) ?? []), target]);
    return (groupId) => {
        const members = byGroup.get(groupId);
        if (!members)
            return undefined;
        return (members.find((member) => member.locale === locale) ??
            members.find((member) => member.id === member.translationGroupId) ??
            members[0]);
    };
}
const relationIdsOfRecord = (site, record) => site.isCollection(record.collection)
    ? relationFieldsOf(site, record.collection).flatMap(({ name }) => idsOf(record.metadata[name]))
    : [];
/** Relation targets of each record: the published version of each, this locale -> source text. */
function resolveRelations(site, records, locale, pick) {
    const relationOf = (groupId) => {
        const chosen = pick(groupId);
        if (!chosen)
            return null;
        return {
            id: chosen.translationGroupId,
            collection: chosen.collection,
            locale: chosen.locale,
            slug: chosen.slug,
            title: titleOf(site, chosen, locale),
            path: pathOf(site, chosen.collection, chosen.slug, chosen.locale),
        };
    };
    const result = new Map();
    for (const record of records) {
        const relations = {};
        if (site.isCollection(record.collection)) {
            for (const { name } of relationFieldsOf(site, record.collection)) {
                relations[name] = idsOf(record.metadata[name])
                    .map(relationOf)
                    .filter((relation) => relation !== null);
            }
        }
        result.set(record.id, relations);
    }
    return result;
}
/**
 * The refs of each record's document. The media of all records is looked up together (each id once); a record gets only the ids its own document
 * holds, so a read never lists a media item or a link target the document does not use. A link target is the published version in the reader's
 * language, else the source's; one that is not published, or has no public path, is left out (the renderer draws that link as plain text).
 */
async function resolveRefs(deps, records, locale, pick) {
    const idsByRecord = new Map(records.map((record) => [record.id, collectRefs(record.doc)]));
    const resolved = await resolvePublicMedia(deps, [...new Set([...idsByRecord.values()].flatMap((ids) => ids.media))]);
    const linkOf = (groupId) => {
        const chosen = pick(groupId);
        const path = chosen && pathOf(deps.site, chosen.collection, chosen.slug, chosen.locale);
        return chosen && path ? { path, title: titleOf(deps.site, chosen, locale), locale: chosen.locale } : undefined;
    };
    return new Map(records.map((record) => {
        const ids = idsByRecord.get(record.id);
        const media = {};
        for (const mediaId of ids?.media ?? []) {
            // An id with no media row is left out: a renderer reads it as unresolved.
            const result = resolved.get(mediaId);
            if (result)
                media[mediaId] = result;
        }
        const links = {};
        for (const groupId of ids?.links ?? []) {
            const link = linkOf(groupId);
            if (link)
                links[groupId] = link;
        }
        return [
            record.id,
            Object.keys(media).length > 0 || Object.keys(links).length > 0 ? { media, links } : EMPTY_REFS,
        ];
    }));
}
/** The refs of a read as the lookups a format uses: links by the address they resolved to, media by public URL. */
const exportRefsOf = (refs) => ({
    links: Object.fromEntries(Object.entries(refs.links).map(([id, link]) => [
        id,
        { url: link.path, title: link.title, locale: link.locale },
    ])),
    media: Object.fromEntries(Object.entries(refs.media).flatMap(([id, media]) => "url" in media
        ? [
            [
                id,
                {
                    url: media.url,
                    ...(media.width === undefined ? {} : { width: media.width }),
                    ...(media.height === undefined ? {} : { height: media.height }),
                    filename: media.file?.filename ?? "",
                    mimeType: media.file?.mimeType ?? null,
                    byteSize: media.file?.byteSize ?? null,
                },
            ],
        ]
        : [])),
});
async function toReadEntries(deps, records, locale, fallback = false, format) {
    const { site } = deps;
    const formats = format === undefined ? undefined : await deps.formats();
    if (formats && format !== undefined && !formats.get(format))
        throw unknownFormatError(format, formats);
    // Relation targets and link targets are the same kind of thing (a published entry by translation group id), so they are looked up together.
    const pick = await publishedPicker(deps.store(), records.flatMap((record) => [...relationIdsOfRecord(site, record), ...collectRefs(record.doc).links]), locale);
    const relations = resolveRelations(site, records, locale, pick);
    const refs = await resolveRefs(deps, records, locale, pick);
    const bodies = new Map();
    if (formats && format !== undefined) {
        for (const record of records) {
            if (!record.doc)
                continue;
            const { text } = await exportText(site, formats, format, record.doc, {
                locale: record.locale,
                purpose: "read",
                refs: exportRefsOf(refs.get(record.id) ?? EMPTY_REFS),
            });
            bodies.set(record.id, { format, text });
        }
    }
    return records.map((record) => ({
        id: record.id,
        collection: record.collection,
        locale: record.locale,
        translationGroupId: record.translationGroupId,
        slug: record.slug,
        path: pathOf(site, record.collection, record.slug, record.locale),
        title: titleOf(site, record, locale),
        // Values of fields the site has removed stay stored but are not public: the site code sees the shape its config types.
        metadata: (site.isCollection(record.collection)
            ? site.schemaMetadata(record.collection, record.metadata)
            : record.metadata),
        relations: relations.get(record.id) ?? {},
        publishedAt: record.publishedAt,
        updatedAt: record.updatedAt,
        doc: record.doc,
        refs: refs.get(record.id) ?? EMPTY_REFS,
        ...(bodies.has(record.id) ? { body: bodies.get(record.id) } : {}),
        fallback,
    }));
}
const assertCollection = (site, collection) => {
    if (!site.isCollection(collection))
        throw new Error(`cms/read: unknown collection "${collection}"`);
    return collection;
};
/** An item collection has only the default locale (the name is picked from the per-locale values). */
const storageLocale = (site, collection, locale) => site.isItemCollection(collection)
    ? site.DEFAULT_LOCALE
    : locale && site.isLocale(locale)
        ? locale
        : site.DEFAULT_LOCALE;
export function createRead(deps) {
    const { site } = deps;
    return {
        async getEntry(params) {
            const collection = assertCollection(site, params.collection);
            const locale = storageLocale(site, collection, params.locale);
            const slug = params.slug.normalize("NFC").trim();
            if (!slug)
                return { status: "not_found" };
            const store = deps.store();
            let lookup = await store.getPublishedEntryBySlug({ collection, slug, locale, includeBody: true });
            let fellBack = false;
            if (lookup.status === "not_found" && params.fallback && locale !== site.DEFAULT_LOCALE) {
                lookup = await store.getPublishedEntryBySlug({
                    collection,
                    slug,
                    locale: site.DEFAULT_LOCALE,
                    includeBody: true,
                });
                fellBack = lookup.status !== "not_found";
            }
            if (lookup.status === "not_found")
                return { status: "not_found" };
            const [entry] = await toReadEntries(deps, [lookup.entry], params.locale ?? locale, fellBack, params.format);
            if (!entry)
                return { status: "not_found" };
            if (lookup.status === "alias")
                return { status: "redirect", slug: entry.slug, path: entry.path, entry };
            return { status: "found", entry };
        },
        async listEntries(params) {
            const collection = assertCollection(site, params.collection);
            const locale = storageLocale(site, collection, params.locale);
            const store = deps.store();
            const result = await store.listPublishedPage({
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
            return {
                ...result,
                items: await toReadEntries(deps, result.items, params.locale ?? locale, false, params.format),
            };
        },
        async getTranslations(params) {
            const members = await deps.store().listPublishedTranslations(params);
            return members.map((member) => ({
                locale: member.locale,
                slug: member.slug,
                path: pathOf(site, member.collection, member.slug, member.locale),
            }));
        },
        async getPreview(params) {
            try {
                await deps.verifyAdmin();
            }
            catch {
                return null;
            }
            const collection = assertCollection(site, params.collection);
            const locale = storageLocale(site, collection, params.locale);
            const store = deps.store();
            const draft = await store.getWorkingEntryBySlug({ collection, slug: params.slug, locale });
            if (!draft || draft.status === "trashed")
                return null;
            let metadata = draft.working.metadata;
            if (draft.translationGroupId !== draft.id) {
                const source = await store.getEntry(draft.translationGroupId).catch(() => null);
                if (source)
                    metadata = site.mergeTranslationMetadata(collection, source.working.metadata, metadata);
            }
            const record = {
                id: draft.id,
                collection,
                locale: draft.locale,
                translationGroupId: draft.translationGroupId,
                slug: draft.workingSlug ?? params.slug,
                metadata,
                doc: draft.working.doc,
                publishedAt: draft.publishedAt ?? null,
                updatedAt: draft.updatedAt,
            };
            const [entry] = await toReadEntries(deps, [record], locale, false, params.format);
            return entry ?? null;
        },
        mediaUrl: (mediaId) => resolvePublicMediaUrl(deps, mediaId),
    };
}
/**
 * Resolves what documents point to, for writing them as text outside a page read: `published` resolves links the way a reader sees them (the published
 * version of the target in the document's language, else the source's; an unpublished target is not a link). `working` is for a draft or a backup: the target
 * is whichever entry the id names, at its current address (its draft address when it is not published yet), unless it is trashed or has no public path.
 * Media is the ready file either way. Lookups are remembered, so exporting many documents asks for each target once.
 */
export function createExportRefs(deps, scope) {
    const links = new Map();
    const media = new Map();
    const store = () => deps.store();
    const workingLink = async (id, locale) => {
        try {
            const entry = await store().getEntry(id);
            if (entry.status === "trashed")
                return null;
            const group = await store().getTranslationGroup({ entryId: id });
            const member = group.members.find((item) => item.locale === locale) ?? group.members.find((item) => item.isSource);
            if (!member?.workingSlug)
                return null;
            const path = pathOf(deps.site, entry.collection, member.workingSlug, member.locale);
            return path ? { url: path, title: member.title, locale: member.locale } : null;
        }
        catch {
            return null;
        }
    };
    return async (doc, locale) => {
        const ids = collectRefs(doc);
        const missingLinks = ids.links.filter((id) => !links.has(`${locale}:${id}`));
        if (scope === "published") {
            const pick = await publishedPicker(store(), missingLinks, locale);
            for (const id of missingLinks) {
                const chosen = pick(id);
                const path = chosen && pathOf(deps.site, chosen.collection, chosen.slug, chosen.locale);
                links.set(`${locale}:${id}`, chosen && path ? { url: path, title: titleOf(deps.site, chosen, locale), locale: chosen.locale } : null);
            }
        }
        else {
            for (const id of missingLinks)
                links.set(`${locale}:${id}`, await workingLink(id, locale));
        }
        const missingMedia = ids.media.filter((id) => !media.has(id));
        if (missingMedia.length > 0) {
            const resolved = await resolvePublicMedia(deps, missingMedia);
            for (const id of missingMedia) {
                const result = resolved.get(id);
                media.set(id, result && "url" in result
                    ? {
                        url: result.url,
                        ...(result.width === undefined ? {} : { width: result.width }),
                        ...(result.height === undefined ? {} : { height: result.height }),
                        filename: result.file?.filename ?? "",
                        mimeType: result.file?.mimeType ?? null,
                        byteSize: result.file?.byteSize ?? null,
                    }
                    : null);
            }
        }
        const found = (entries) => new Map(entries.filter((entry) => entry[1] !== null));
        return {
            links: found(ids.links.map((id) => [id, links.get(`${locale}:${id}`) ?? null])),
            media: found(ids.media.map((id) => [id, media.get(id) ?? null])),
        };
    };
}
export { collectRefs } from "../doc/document-refs.js";
