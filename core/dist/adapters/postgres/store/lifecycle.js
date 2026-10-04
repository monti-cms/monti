import { isItemCollection } from "../../../core/collections.js";
import { withTransaction } from "./context.js";
import { CmsError, mapEntryWriteError } from "./errors.js";
import { loadEntry, lockEntryForUpdate } from "./rows.js";
/**
 * Status transitions. A disallowed source status is rejected with `invalid_status` (409),
 * for example so that pressing `보관 해제` or `복원` on a published entry cannot silently take it offline.
 */
export function createLifecycleOps(ctx, publishing) {
    const { pool, qSchema } = ctx;
    const transition = (params, allowedFrom, apply) => withTransaction(pool, async (client) => {
        const locked = await lockEntryForUpdate(client, qSchema, params.id, params.expectedVersion);
        if (!allowedFrom.includes(locked.status)) {
            throw new CmsError(`Cannot change status from ${locked.status}`, "invalid_status", locked.version);
        }
        await apply(client, locked);
        return loadEntry(client, params.id, qSchema);
    }, { mapError: mapEntryWriteError });
    /**
     * For a source, locks and returns the translations in the same group (excluding itself). For a translation, returns an empty list.
     * A source's status transition applies to the whole group.
     */
    const lockTranslations = async (client, id) => (await client.query(`SELECT id, status, version, trashed_at FROM "${qSchema}".entries
				 WHERE translation_group_id = $1 AND id <> $1 ORDER BY id FOR UPDATE`, [id])).rows;
    /** Changes the translations' status and bumps their version. Editors left open notice it as a conflict. */
    const setMembersStatus = async (client, ids, status, extra = "") => {
        if (ids.length === 0)
            return;
        await client.query(`UPDATE "${qSchema}".entries SET status = $1, version = version + 1${extra} WHERE id = ANY($2::uuid[])`, [status, ids]);
    };
    /** Slugs that were ever published keep only a reuse-prevention record; reserved slugs are released before the content is deleted. */
    const deleteEntryRow = async (client, id) => {
        await client.query(`DELETE FROM "${qSchema}".content_addresses WHERE entry_id = $1 AND type = 'reservation'`, [id]);
        await client.query(`UPDATE "${qSchema}".content_addresses SET type = 'deleted', entry_id = NULL WHERE entry_id = $1`, [id]);
        await client.query(`DELETE FROM "${qSchema}".entries WHERE id = $1`, [id]);
    };
    return {
        /** Draft/published to archived. Ends publication. Record collections have no archive. */
        archiveEntry: (params) => transition(params, ["draft", "published"], async (client, locked) => {
            if (isItemCollection(locked.collection)) {
                throw new CmsError("Record collections cannot be archived", "invalid_status", locked.version);
            }
            await client.query(`UPDATE "${qSchema}".entries SET status = 'archived', version = $1 WHERE id = $2`, [
                locked.version + 1,
                params.id,
            ]);
            const members = (await lockTranslations(client, params.id)).filter((member) => member.status === "draft" || member.status === "published");
            const ids = members.map((member) => member.id);
            await setMembersStatus(client, ids, "archived");
        }),
        /** Archived to draft. Does not republish automatically. */
        unarchiveEntry: (params) => transition(params, ["archived"], async (client, locked) => {
            await client.query(`UPDATE "${qSchema}".entries SET status = 'draft', version = $1 WHERE id = $2`, [
                locked.version + 1,
                params.id,
            ]);
            const members = (await lockTranslations(client, params.id)).filter((member) => member.status === "archived");
            await setMembersStatus(client, members.map((member) => member.id), "draft");
        }),
        /**
         * To trash. Ends publication.
         * A category item in use (record collections: tags, categories, etc.) must have its references released first.
         */
        trashEntry: (params) => transition(params, ["draft", "published", "archived"], async (client, locked) => {
            if (isItemCollection(locked.collection)) {
                await publishing.assertNotReferenced(client, params.id, { ignoreTrashedSources: true });
            }
            await client.query(`UPDATE "${qSchema}".entries SET status = 'trashed', trashed_at = NOW(), version = $1 WHERE id = $2`, [locked.version + 1, params.id]);
            // NOW() is the same value within one transaction. On restore, this timestamp finds the "translations trashed together".
            const ids = (await lockTranslations(client, params.id))
                .filter((member) => member.status !== "trashed")
                .map((member) => member.id);
            await setMembersStatus(client, ids, "trashed", ", trashed_at = NOW()");
        }),
        /**
         * Trash to restore. Publish collections return to draft; record collections are validated for current values and relations
         * and then returned to active (published) records.
         */
        restoreEntry: (params) => transition(params, ["trashed"], async (client, locked) => {
            const isSource = locked.translation_group_id === params.id;
            if (!isSource) {
                // Restoring a translation without its source leaves it absent from the list (one row per source) and without shared values.
                const source = await client.query(`SELECT status FROM "${qSchema}".entries WHERE id = $1`, [locked.translation_group_id]);
                if (source.rows[0]?.status === "trashed") {
                    throw new CmsError("Restore the source first", "source_trashed", locked.version);
                }
            }
            const trashedAt = isSource
                ? (await client.query(`SELECT trashed_at FROM "${qSchema}".entries WHERE id = $1`, [params.id])).rows[0]?.trashed_at
                : null;
            const version = locked.version + 1;
            await client.query(`UPDATE "${qSchema}".entries SET status = 'draft', trashed_at = NULL, version = $1 WHERE id = $2`, [version, params.id]);
            if (isItemCollection(locked.collection)) {
                await publishing.publishWithinTransaction(client, params.id, { expectedVersion: version });
            }
            // Restore only translations trashed together with the source. Translations trashed separately stay in the trash.
            if (isSource && trashedAt) {
                const ids = (await lockTranslations(client, params.id))
                    .filter((member) => member.status === "trashed" && member.trashed_at?.getTime() === trashedAt.getTime())
                    .map((member) => member.id);
                await setMembersStatus(client, ids, "draft", ", trashed_at = NULL");
            }
        }),
        /**
         * Permanently deletes a trashed entry. Rejected if other content references it.
         * Slugs that were ever published keep only a reuse-prevention record (`deleted`); reserved slugs that were never published are released.
         */
        permanentDeleteEntry: async (params) => withTransaction(pool, async (client) => {
            const locked = await lockEntryForUpdate(client, qSchema, params.id, params.expectedVersion);
            if (locked.status !== "trashed") {
                throw new CmsError("Only trashed entries can be permanently deleted", "invalid_status", locked.version);
            }
            await publishing.assertNotReferenced(client, params.id, { ignoreTrashedSources: false });
            // Deleting a source deletes its translations too. Rejected if a translation outside the trash remains, since it would lose its shared values.
            const members = await lockTranslations(client, params.id);
            const alive = members.filter((member) => member.status !== "trashed");
            if (alive.length > 0) {
                const translations = await client.query(`SELECT id, locale FROM "${qSchema}".entries WHERE id = ANY($1::uuid[]) ORDER BY locale`, [alive.map((member) => member.id)]);
                throw new CmsError("Delete the translations first", "has_translations", locked.version, {
                    translations: translations.rows,
                });
            }
            for (const member of members) {
                await publishing.assertNotReferenced(client, member.id, { ignoreTrashedSources: false });
                await deleteEntryRow(client, member.id);
            }
            await deleteEntryRow(client, params.id);
        }),
    };
}
