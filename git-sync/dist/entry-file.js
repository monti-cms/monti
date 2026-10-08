import { isDeepStrictEqual } from "node:util";
import { composeFile, parseFile } from "@monti-cms/core/front-matter";
import { exportBodyText } from "@monti-cms/core/plugin/server";
import { blobSha } from "./github/blob-sha.js";
import { RESERVED_FRONT_MATTER_KEYS } from "./options.js";
/** Whether an entry has a published version with an address (the only kind that has a file). */
export const isSyncable = (entry, target) => entry !== null &&
    entry.status === "published" &&
    entry.published !== undefined &&
    typeof entry.publishedSlug === "string" &&
    entry.publishedSlug !== "" &&
    target.collections.includes(entry.collection);
const iso = (value) => {
    if (value === undefined || value === null)
        return undefined;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};
/** The relation fields of a collection: name, the collection they point to, and whether they hold a list. */
export function relationFieldsOf(cms, collection) {
    if (!cms.site.isCollection(collection))
        return [];
    return cms.site
        .storedFields(collection)
        .flatMap(({ name, field }) => field.kind === "relation" ? [{ name, to: field.to, many: field.many === true }] : []);
}
const idsOf = (value) => typeof value === "string"
    ? [value]
    : Array.isArray(value)
        ? value.filter((item) => typeof item === "string")
        : [];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/**
 * The slug a relation target is written as for a reader in `locale`: its published slug in that language, else the source's, else any. `undefined` when the target is
 * not published (the id stands in for it).
 */
async function slugsOfTargets(cms, ids, locale) {
    const found = new Map();
    if (ids.length === 0)
        return found;
    const records = await cms.store().listPublishedByGroups({ translationGroupIds: [...new Set(ids)] });
    for (const id of new Set(ids)) {
        const members = records.filter((record) => record.translationGroupId === id);
        const chosen = members.find((record) => record.locale === locale) ?? members.find((record) => record.id === id) ?? members[0];
        if (chosen)
            found.set(id, chosen.slug);
    }
    return found;
}
/** The front matter key of the title. */
const FRONT_MATTER_TITLE = "title";
/** The front matter of an entry. Fields come in the order the collection declares them; relations are slugs with the exact ids under `monti.refs`. */
export async function frontMatterOf(cms, entry, version) {
    const metadata = version.body.metadata;
    const declared = cms.site.isCollection(entry.collection)
        ? cms.site.storedFields(entry.collection).map((stored) => stored.name)
        : [];
    const data = {};
    // The title is written as `title` whatever the field is named (see the file format above).
    const titleName = cms.site.isCollection(entry.collection) ? cms.site.titleField(entry.collection).name : undefined;
    const keyOf = (name) => (name === titleName ? FRONT_MATTER_TITLE : name);
    for (const key of declared)
        if (metadata[key] !== undefined)
            data[keyOf(key)] = metadata[key];
    for (const key of Object.keys(metadata).sort()) {
        // A stored `title` that is not the title field (left behind by a rename) must not take the place of the title.
        if (titleName !== undefined && key !== titleName && keyOf(key) === FRONT_MATTER_TITLE)
            continue;
        if (data[keyOf(key)] === undefined)
            data[keyOf(key)] = metadata[key];
    }
    const refs = {};
    const relations = relationFieldsOf(cms, entry.collection);
    const slugs = await slugsOfTargets(cms, relations.flatMap(({ name }) => idsOf(metadata[name])), entry.locale);
    for (const { name, many } of relations) {
        const ids = idsOf(metadata[name]);
        if (ids.length === 0)
            continue;
        refs[name] = many ? ids : ids[0];
        // An unpublished target has no address: its id stands in for the slug.
        const written = ids.map((id) => slugs.get(id) ?? id);
        data[name] = many ? written : written[0];
    }
    data.slug = version.slug;
    const date = iso(entry.publishedAt);
    if (date)
        data.date = date;
    const lastmod = iso(version.body.updatedAt);
    if (lastmod)
        data.lastmod = lastmod;
    data.monti = {
        id: entry.id,
        collection: entry.collection,
        locale: entry.locale,
        ...(entry.translationGroupId !== entry.id ? { translationOf: entry.translationGroupId } : {}),
        ...(Object.keys(refs).length > 0 ? { refs } : {}),
    };
    return data;
}
/** Writes the file of a published entry through the target's format (`purpose: "sync"`, front matter included). */
export async function exportEntry(cms, target, pattern, entry) {
    return exportVersion(cms, target, pattern, entry, "published", {
        body: entry.published,
        slug: entry.publishedSlug,
    });
}
async function exportVersion(cms, target, pattern, entry, scope, version) {
    const { text: body } = await exportBodyText(cms, {
        format: target.format,
        doc: version.body.doc,
        locale: entry.locale,
        scope,
    });
    const text = composeFile(await frontMatterOf(cms, entry, version), body);
    return {
        path: pattern.render({
            collection: entry.collection,
            slug: version.slug,
            locale: entry.locale,
            id: entry.id,
        }),
        text,
        blobSha: blobSha(text),
        slug: version.slug,
        contentHash: version.body.contentHash,
    };
}
const stringOf = (value) => typeof value === "string" && value !== "" ? value : undefined;
/** Reads the text of a file into the entry it says. */
export function parseEntryFile(text) {
    const parsed = parseFile(text);
    if (!parsed.ok)
        return { ok: false, message: parsed.line ? `${parsed.message} (line ${parsed.line})` : parsed.message };
    const { data } = parsed;
    const monti = data.monti;
    if (monti !== undefined && (typeof monti !== "object" || monti === null || Array.isArray(monti))) {
        return { ok: false, message: "front matter key `monti` must be a mapping (id, collection, locale)" };
    }
    if (data.slug !== undefined && typeof data.slug !== "string") {
        return { ok: false, message: "front matter key `slug` must be text" };
    }
    const identity = (monti ?? {});
    const refs = {};
    if (identity.refs !== undefined) {
        if (typeof identity.refs !== "object" || identity.refs === null || Array.isArray(identity.refs)) {
            return {
                ok: false,
                message: "front matter key `monti.refs` must be a mapping of field name to id (or list of ids)",
            };
        }
        for (const [name, value] of Object.entries(identity.refs)) {
            const ids = idsOf(value);
            if (ids.length !== (Array.isArray(value) ? value.length : 1)) {
                return { ok: false, message: `front matter key \`monti.refs.${name}\` must hold ids (text)` };
            }
            refs[name] = ids;
        }
    }
    const metadata = { ...data };
    for (const key of RESERVED_FRONT_MATTER_KEYS)
        delete metadata[key];
    return {
        ok: true,
        file: {
            metadata,
            slug: stringOf(data.slug),
            id: stringOf(identity.id),
            collection: stringOf(identity.collection),
            locale: stringOf(identity.locale),
            translationOf: stringOf(identity.translationOf),
            refs,
            body: parsed.body,
        },
    };
}
/** Whether two file texts say the same entry: the same fields, slug and body (the dates, which are only for the site, are not compared). */
export function sameContent(left, right) {
    if (left === right)
        return true;
    const a = parseEntryFile(left);
    const b = parseEntryFile(right);
    if (!a.ok || !b.ok)
        return false;
    return (isDeepStrictEqual(a.file.metadata, b.file.metadata) &&
        a.file.slug === b.file.slug &&
        a.file.body.trim() === b.file.body.trim());
}
/** What the relation fields of a file point to could not be found. Carries one message per field. */
export class RelationImportError extends Error {
    problems;
    constructor(problems) {
        super(problems.join("; "));
        this.problems = problems;
        this.name = "RelationImportError";
    }
}
/**
 * The metadata of a file with its relation fields turned into ids. A field takes the ids of `monti.refs` when each of them still has the slug the field says (or is
 * itself what the field says: an unpublished target is written as its id); otherwise every value is looked up as a slug of the field's target collection
 * (published first, then drafts, in the file's language and then the default one). A slug no entry has is an error that names the field and the slug.
 */
export async function resolveRelations(cms, file, where) {
    const metadata = { ...file.metadata };
    // The front matter calls the title `title`, whatever the field is named.
    const titleName = cms.site.isCollection(where.collection) ? cms.site.titleField(where.collection).name : undefined;
    if (titleName !== undefined && titleName !== FRONT_MATTER_TITLE && Object.hasOwn(metadata, FRONT_MATTER_TITLE)) {
        metadata[titleName] = metadata[FRONT_MATTER_TITLE];
        delete metadata[FRONT_MATTER_TITLE];
    }
    const problems = [];
    for (const { name, to, many } of relationFieldsOf(cms, where.collection)) {
        if (metadata[name] === undefined)
            continue;
        const written = idsOf(metadata[name]);
        if (written.length !== (Array.isArray(metadata[name]) ? metadata[name].length : 1)) {
            problems.push(`field ${name}: values must be slugs (text)`);
            continue;
        }
        const refs = file.refs[name];
        if (refs && refs.length === written.length) {
            const slugs = await slugsOfTargets(cms, refs, where.locale);
            if (refs.every((id, index) => (slugs.get(id) ?? id) === written[index])) {
                metadata[name] = many ? [...refs] : refs[0];
                continue;
            }
        }
        const ids = [];
        for (const value of written) {
            if (UUID.test(value)) {
                ids.push(value);
                continue;
            }
            const id = await entryIdBySlug(cms, to, value, where.locale);
            if (id)
                ids.push(id);
            else
                problems.push(`field ${name}: no ${to} has the slug "${value}"`);
        }
        metadata[name] = many ? ids : ids[0];
    }
    if (problems.length > 0)
        throw new RelationImportError(problems);
    return metadata;
}
/** The id (translation group id) of the entry of a collection that has this slug. */
async function entryIdBySlug(cms, collection, slug, locale) {
    const store = cms.store();
    for (const language of new Set([locale, cms.site.DEFAULT_LOCALE])) {
        const published = await store.getPublishedEntryBySlug({ collection, slug, locale: language, includeBody: false });
        // A former slug (`alias`) still names the entry: a file written before the target was renamed keeps working.
        if (published.status !== "not_found")
            return published.entry.translationGroupId;
    }
    for (const language of new Set([locale, cms.site.DEFAULT_LOCALE])) {
        const draft = await store.getWorkingEntryBySlug({ collection, slug, locale: language });
        if (draft)
            return draft.translationGroupId;
    }
    return undefined;
}
