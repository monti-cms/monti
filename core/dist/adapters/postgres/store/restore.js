import { splitTemplates } from "../../../core/domain/restore.js";
import { CmsError } from "../../../core/store/errors.js";
import { withTrx } from "./context.js";
import { insertReferences, writeBody } from "./rows.js";
const countOf = async (db, table) => {
    const row = await db
        .selectFrom(table)
        .select((eb) => eb.fn.countAll().as("n"))
        .executeTakeFirstOrThrow();
    return Number(row.n);
};
const readCounts = async (db) => ({
    entries: await countOf(db, "entries"),
    folders: await countOf(db, "folders"),
    media: await countOf(db, "media_assets"),
});
/** The folders in an order a parent comes before its children, so each row finds its parent when it is inserted. */
function parentsFirst(folders) {
    const byId = new Map(folders.map((folder) => [folder.id, folder]));
    const ordered = [];
    const done = new Set();
    const visit = (folder, path) => {
        if (done.has(folder.id))
            return;
        if (path.has(folder.id))
            throw new CmsError(`Folder ${folder.id} is its own ancestor`, "invalid_input");
        const parent = folder.parentId ? byId.get(folder.parentId) : undefined;
        if (parent)
            visit(parent, new Set(path).add(folder.id));
        done.add(folder.id);
        ordered.push(folder);
    };
    for (const folder of folders)
        visit(folder, new Set());
    return ordered;
}
/**
 * Restoring a backup into an empty site. Everything is written in one transaction: the tables that hold the content, and the ones derived from it
 * (the search text of each body, the reference index, the addresses). Nothing is recorded in the event outbox, so no subscriber hears of it.
 */
export function createRestoreOps(ctx) {
    const { site, qSchema } = ctx;
    const db = ctx.db();
    return {
        countSiteContent: async () => readCounts(db),
        restoreArchive: async (plan) => withTrx(ctx, async (trx, client) => {
            // No write can slip in between the emptiness check and the inserts.
            await client.query(`LOCK TABLE "${qSchema}".entries, "${qSchema}".folders, "${qSchema}".media_assets, "${qSchema}".content_addresses, "${qSchema}".body_templates IN SHARE ROW EXCLUSIVE MODE`);
            const counts = await readCounts(trx);
            if (counts.entries + counts.folders + counts.media > 0) {
                throw new CmsError("The site is not empty", "conflict", {
                    details: counts,
                    notice: { key: "restore.not_empty" },
                });
            }
            for (const folder of parentsFirst(plan.folders)) {
                await trx
                    .insertInto("folders")
                    .values({
                    id: folder.id,
                    collection: folder.collection,
                    parent_id: folder.parentId,
                    name: folder.name,
                    position: folder.position,
                    version: folder.version,
                })
                    .execute();
            }
            for (const asset of plan.media) {
                await trx
                    .insertInto("media_assets")
                    .values({
                    id: asset.id,
                    folder_id: asset.folderId,
                    status: asset.status,
                    filename: asset.filename,
                    mime_type: asset.mimeType,
                    byte_size: asset.byteSize,
                    width: asset.width,
                    height: asset.height,
                    staging_key: asset.stagingKey,
                    storage_key: asset.storageKey,
                    created_at: asset.createdAt,
                    updated_at: asset.updatedAt,
                    ready_at: asset.readyAt,
                    default_alt: asset.defaultAlt,
                    default_caption: asset.defaultCaption,
                    original_staging_key: asset.original?.stagingKey ?? null,
                    original_storage_key: asset.original?.storageKey ?? null,
                    original_mime_type: asset.original?.mimeType ?? null,
                    original_byte_size: asset.original?.byteSize ?? null,
                    original_width: asset.original?.width ?? null,
                    original_height: asset.original?.height ?? null,
                })
                    .execute();
            }
            // A translation names its source (a foreign key), so the sources are inserted first.
            const isSource = (entry) => entry.translationGroupId === entry.id;
            const ordered = [...plan.entries.filter(isSource), ...plan.entries.filter((entry) => !isSource(entry))];
            for (const entry of ordered) {
                await trx
                    .insertInto("entries")
                    .values({
                    id: entry.id,
                    collection: entry.collection,
                    version: entry.version,
                    created_at: entry.createdAt,
                    updated_at: entry.updatedAt,
                    published_at: entry.publishedAt,
                    working_slug: entry.workingSlug,
                    folder_id: entry.folderId,
                    status: entry.status,
                    trashed_at: entry.trashedAt,
                    locale: entry.locale,
                    translation_group_id: isSource(entry) ? null : entry.translationGroupId,
                    changed_by: entry.changedBy,
                    changed_at: entry.changedAt,
                })
                    .execute();
                await writeBody(site, trx, entry.id, "working", {
                    metadata: entry.working.metadata,
                    doc: entry.working.doc,
                    contentHash: entry.working.contentHash,
                    updatedAt: entry.working.updatedAt,
                    translation: entry.working.translation ?? null,
                });
                if (entry.published) {
                    await writeBody(site, trx, entry.id, "published", {
                        metadata: entry.published.metadata,
                        doc: entry.published.doc,
                        contentHash: entry.published.contentHash,
                        updatedAt: entry.published.updatedAt,
                        translation: entry.published.translation ?? null,
                    });
                }
            }
            for (const address of plan.addresses) {
                await trx
                    .insertInto("content_addresses")
                    .values({
                    collection: address.collection,
                    locale: address.locale,
                    slug: address.slug,
                    entry_id: address.entryId,
                    type: address.type,
                })
                    .execute();
            }
            // The reference index points at entries and media, so it goes in after both.
            const grouped = new Map();
            for (const reference of plan.references) {
                const key = `${reference.entryId}\u0000${reference.state}`;
                const list = grouped.get(key) ?? [];
                list.push({
                    kind: reference.kind,
                    targetId: reference.targetId,
                    isStale: reference.isStale,
                    occurrences: reference.occurrences,
                });
                grouped.set(key, list);
            }
            for (const [key, references] of grouped) {
                const [entryId, state] = key.split("\u0000");
                await insertReferences(trx, entryId, state, references);
            }
            // The templates the site was seeded with stay. One whose id or name the site has is skipped (names are unique, ignoring case).
            const existing = await trx.selectFrom("body_templates").select(["id", "name"]).execute();
            const { add, skipped } = splitTemplates(existing, plan.templates);
            for (const template of add) {
                await trx
                    .insertInto("body_templates")
                    .values({
                    id: template.id,
                    name: template.name,
                    version: template.version,
                    created_at: template.createdAt,
                    updated_at: template.updatedAt,
                    doc: JSON.stringify(template.doc),
                })
                    .execute();
            }
            const byStatus = {};
            for (const entry of plan.entries)
                byStatus[entry.status] = (byStatus[entry.status] ?? 0) + 1;
            return {
                entries: plan.entries.length,
                byStatus,
                translations: plan.entries.filter((entry) => !isSource(entry)).length,
                folders: plan.folders.length,
                media: plan.media.length,
                addresses: plan.addresses.length,
                references: plan.references.length,
                templatesAdded: add.length,
                templatesSkipped: skipped,
            };
        }),
    };
}
