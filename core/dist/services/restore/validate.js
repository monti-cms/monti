import { assertKnownLocale, assertTranslationMetadata, assertTranslationStateAllowed, } from "../../core/domain/translation.js";
import { isUuid } from "../../core/ids.js";
import { prepareSnapshot, validateForPublish } from "../../core/snapshot.js";
import { CmsError } from "../../core/store/errors.js";
import { ServiceError } from "../../core/types.js";
/** The folders of media files are the ones of this pseudo-collection. */
const MEDIA_FOLDERS = "media";
/** What a person recognises an entry by: its title, else its address. */
function labelOf(site, entry) {
    if (site.isCollection(entry.collection)) {
        const name = site.roleField(entry.collection, "title")?.name;
        const title = name ? entry.working.metadata[name] : undefined;
        if (typeof title === "string" && title.trim())
            return title.trim();
    }
    return entry.workingSlug ?? entry.publishedSlug;
}
/** Runs a check that throws, and says what it threw. Anything but a `CmsError` is not a finding about the archive, so it goes on up. */
async function attempt(run) {
    try {
        return { ok: true, value: await run() };
    }
    catch (error) {
        if (error instanceof CmsError)
            return { ok: false, error };
        throw error;
    }
}
/** The input a save of this body would be given, so the body is checked by the same rules a save uses. */
const saveInput = (entry, body, slug) => ({
    collection: entry.collection,
    slug,
    metadata: body.metadata,
    doc: body.doc,
    ...(body.translation ? { translation: body.translation } : {}),
});
/**
 * Checks a backup against the site it is restored into, without writing anything, and lists every problem. The checks are the ones a normal write makes:
 * - every id is an id, and no id or address repeats;
 * - the collection and the language of each entry exist in the schema;
 * - the metadata and the document of each body pass the checks of a save (`prepareSnapshot`), and the published body of an entry that is published passes
 *   those of a publish (`validateForPublish`), against the targets, media and addresses the archive itself holds, because those are what the restored site will have;
 * - every folder, media record, translation source and reference target an entry names is in the archive.
 * The plugins' `beforeSave` and `beforePublish` subscribers do not run: a restore puts back what was already accepted.
 */
export async function validateRestorePlan(site, plan) {
    const problems = [];
    const add = (problem) => problems.push(problem);
    const entryById = new Map();
    const folderById = new Map(plan.folders.map((folder) => [folder.id, folder]));
    const mediaById = new Map(plan.media.map((asset) => [asset.id, asset]));
    // Ids.
    const seen = new Set();
    const checkId = (subject, id, label) => {
        if (!isUuid(id))
            add({ subject, id, label, code: "id_invalid" });
        else if (seen.has(id))
            add({ subject, id, label, code: "id_repeated" });
        seen.add(id);
    };
    for (const entry of plan.entries) {
        checkId("entry", entry.id, labelOf(site, entry));
        entryById.set(entry.id, entry);
    }
    for (const folder of plan.folders)
        checkId("folder", folder.id, folder.name);
    for (const asset of plan.media)
        checkId("media", asset.id, asset.filename);
    const templateIds = new Set();
    for (const template of plan.templates) {
        if (!isUuid(template.id))
            add({ subject: "template", id: template.id, label: template.name, code: "id_invalid" });
        else if (templateIds.has(template.id))
            add({ subject: "template", id: template.id, label: template.name, code: "id_repeated" });
        templateIds.add(template.id);
    }
    // Folders: the parent is in the archive, and the tree has no loop.
    for (const folder of plan.folders) {
        if (folder.parentId !== null && !folderById.has(folder.parentId)) {
            add({
                subject: "folder",
                id: folder.id,
                label: folder.name,
                code: "folder_missing",
                params: { folderId: folder.parentId },
            });
            continue;
        }
        const path = new Set([folder.id]);
        for (let next = folder.parentId; next !== null; next = folderById.get(next)?.parentId ?? null) {
            if (path.has(next)) {
                add({ subject: "folder", id: folder.id, label: folder.name, code: "folder_cycle" });
                break;
            }
            path.add(next);
        }
    }
    for (const asset of plan.media) {
        if (asset.folderId === null)
            continue;
        const folder = folderById.get(asset.folderId);
        if (!folder) {
            add({
                subject: "media",
                id: asset.id,
                label: asset.filename,
                code: "folder_missing",
                params: { folderId: asset.folderId },
            });
        }
        else if (folder.collection !== MEDIA_FOLDERS) {
            add({
                subject: "media",
                id: asset.id,
                label: asset.filename,
                code: "folder_other_collection",
                params: { folderId: folder.id },
            });
        }
    }
    // Addresses.
    const addressKeys = new Set();
    for (const address of plan.addresses) {
        const label = address.slug;
        const key = `${address.collection}\u0000${address.locale}\u0000${address.slug}`;
        if (addressKeys.has(key))
            add({ subject: "address", id: null, label, code: "address_repeated" });
        addressKeys.add(key);
        if (!site.isCollection(address.collection)) {
            add({
                subject: "address",
                id: null,
                label,
                code: "address_collection_unknown",
                params: { collection: address.collection },
            });
        }
        if (address.entryId !== null && !entryById.has(address.entryId)) {
            add({ subject: "address", id: null, label, code: "address_entry_missing", params: { entryId: address.entryId } });
        }
    }
    // References point at entries and media of the archive.
    for (const reference of plan.references) {
        const entry = entryById.get(reference.entryId);
        if (!entry)
            continue;
        const known = reference.kind === "media" ? mediaById.has(reference.targetId) : entryById.has(reference.targetId);
        if (!known) {
            add({
                subject: "entry",
                id: entry.id,
                label: labelOf(site, entry),
                code: reference.kind === "media" ? "media_missing" : "reference_missing",
                params: { targetId: reference.targetId },
            });
        }
    }
    // What a publish looks up: the targets, media and addresses as the restored site will have them.
    const targets = plan.entries.map((entry) => ({
        id: entry.id,
        collection: entry.collection,
        isPublished: entry.status === "published",
        isSource: entry.translationGroupId === entry.id,
    }));
    const media = plan.media.map((asset) => ({ id: asset.id, status: asset.status, storageKey: asset.storageKey }));
    const addressOf = new Map(plan.addresses.map((a) => [`${a.collection}\u0000${a.locale}\u0000${a.slug}`, a]));
    const translationSlots = new Set();
    for (const entry of plan.entries) {
        const label = labelOf(site, entry);
        const here = { subject: "entry", id: entry.id, label };
        const isTranslation = entry.translationGroupId !== entry.id;
        if (!site.isCollection(entry.collection)) {
            add({ ...here, code: "collection_unknown", params: { collection: entry.collection } });
            continue;
        }
        const slot = `${entry.translationGroupId}\u0000${entry.locale}`;
        if (translationSlots.has(slot))
            add({ ...here, code: "translation_repeated", params: { locale: entry.locale } });
        translationSlots.add(slot);
        const locale = await attempt(() => assertKnownLocale(site, entry.locale));
        if (!locale.ok)
            add({ ...here, code: "locale_unknown", params: { locale: entry.locale }, error: locale.error });
        if (entry.folderId !== null) {
            const folder = folderById.get(entry.folderId);
            if (!folder)
                add({ ...here, code: "folder_missing", params: { folderId: entry.folderId } });
            else if (folder.collection !== entry.collection)
                add({ ...here, code: "folder_other_collection", params: { folderId: folder.id } });
        }
        if (isTranslation) {
            const source = entryById.get(entry.translationGroupId);
            if (!source)
                add({ ...here, code: "source_missing", params: { sourceId: entry.translationGroupId } });
            else if (source.collection !== entry.collection || source.translationGroupId !== source.id)
                add({ ...here, code: "source_other_collection", params: { sourceId: source.id } });
            const rules = await attempt(() => {
                assertTranslationMetadata(site, entry.collection, true, entry.working.metadata);
                if (entry.published)
                    assertTranslationMetadata(site, entry.collection, true, entry.published.metadata);
            });
            if (!rules.ok)
                add({ ...here, code: "translation_invalid", error: rules.error });
        }
        const state = await attempt(() => {
            assertTranslationStateAllowed(entry.working.translation ?? null, isTranslation);
            if (entry.published)
                assertTranslationStateAllowed(entry.published.translation ?? null, isTranslation);
        });
        if (!state.ok)
            add({ ...here, code: "translation_invalid", error: state.error });
        // The working body: what a save accepts. (Issues a save accepts, an unparsed body for instance, are kept: the draft was saved with them.)
        const working = await attempt(() => prepareSnapshot(site, saveInput(entry, entry.working, entry.workingSlug), {
            previousMetadata: entry.working.metadata,
        }));
        if (!working.ok)
            add({ ...here, code: "body_invalid", params: { state: "working" }, error: working.error });
        if (entry.status === "published" && !entry.published) {
            add({ ...here, code: "published_body_missing" });
            continue;
        }
        if (!entry.published)
            continue;
        const published = await attempt(() => prepareSnapshot(site, saveInput(entry, entry.published, entry.publishedSlug), {
            previousMetadata: entry.published?.metadata ?? {},
        }));
        if (!published.ok) {
            add({ ...here, code: "body_invalid", params: { state: "published" }, error: published.error });
            continue;
        }
        // The published body of an entry that is published is what readers see, so it must pass the checks of a publish. The published copy that an archived or
        // trashed entry keeps is not public, and is checked as a save only.
        if (entry.status !== "published")
            continue;
        const snapshot = published.value;
        const links = snapshot.internalLinks ?? [];
        const resolved = validateForPublish(site, snapshot, {
            targets,
            media,
            internalLinks: links.map((link) => {
                const address = addressOf.get(`${link.collection}\u0000${link.locale ?? site.DEFAULT_LOCALE}\u0000${link.slug}`);
                const target = address?.entryId ? entryById.get(address.entryId) : undefined;
                return {
                    collection: link.collection,
                    slug: link.slug,
                    ...(link.locale ? { locale: link.locale } : {}),
                    addressType: (address?.type ?? "missing"),
                    isPublished: target?.collection === link.collection && target.status === "published",
                };
            }),
            ...(isTranslation
                ? { translation: { sourcePublished: entryById.get(entry.translationGroupId)?.status === "published" } }
                : {}),
        });
        if (!resolved.ready) {
            add({
                ...here,
                code: "publish_invalid",
                error: new ServiceError("publish_validation_failed", resolved.issues),
            });
        }
    }
    return problems;
}
