import { randomUUID } from "node:crypto";
import { assertNoFolderCycle, assertParentInCollection } from "../../../core/domain/folders.js";
import { CmsError } from "../../../core/store/errors.js";
import { withTrx } from "./context.js";
import { isTransactionConflict, isUniqueViolation } from "./errors.js";
import { mapFolderRow } from "./rows.js";
const COLUMNS = ["id", "collection", "parent_id", "name", "position", "version"];
const mapFolderError = (err) => {
    // A duplicate name under the same parent asks the user to rename.
    if (isUniqueViolation(err, "folders_sibling_name_idx")) {
        return new CmsError("A folder with the same name already exists here", "folder_name_conflict");
    }
    return err;
};
/** Per-collection virtual folders. An admin-only grouping unrelated to entry slugs, tags, or categories. */
export function createFolderOps(ctx) {
    const db = ctx.db();
    const assertParent = async (trx, parentId, collection) => {
        const parent = await trx.selectFrom("folders").select("collection").where("id", "=", parentId).executeTakeFirst();
        assertParentInCollection(parent?.collection, collection);
    };
    return {
        createFolder: async (params) => withTrx(ctx, async (trx) => {
            if (params.parentId)
                await assertParent(trx, params.parentId, params.collection);
            const folder = {
                id: randomUUID(),
                collection: params.collection,
                parentId: params.parentId,
                name: params.name,
                position: params.position ?? 0,
                version: 1,
            };
            await trx
                .insertInto("folders")
                .values({
                id: folder.id,
                collection: folder.collection,
                parent_id: folder.parentId,
                name: folder.name,
                position: folder.position,
                version: 1,
            })
                .execute();
            return folder;
        }, { mapError: mapFolderError }),
        /** The HTTP layer always requires `expectedVersion`. The store compares it only when given. */
        updateFolder: async (params) => withTrx(ctx, async (trx) => {
            const curr = await trx
                .selectFrom("folders")
                .select(COLUMNS)
                .where("id", "=", params.id)
                .forUpdate()
                .executeTakeFirst();
            if (!curr)
                throw new CmsError("Not found", "not_found");
            if (params.expectedVersion !== undefined && curr.version !== params.expectedVersion) {
                throw new CmsError("Conflict", "conflict", curr.version);
            }
            const next = {
                ...curr,
                name: params.name ?? curr.name,
                parent_id: params.parentId !== undefined ? params.parentId : curr.parent_id,
                position: params.position ?? curr.position,
                version: curr.version + 1,
            };
            if (next.parent_id) {
                await assertParent(trx, next.parent_id, curr.collection);
                // The new parent and its ancestors, nearest first. The rule (no cycle) is `assertNoFolderCycle`.
                const ancestors = [];
                let ancestor = next.parent_id;
                while (ancestor && !ancestors.includes(ancestor)) {
                    ancestors.push(ancestor);
                    if (ancestor === params.id)
                        break;
                    const above = await trx
                        .selectFrom("folders")
                        .select("parent_id")
                        .where("id", "=", ancestor)
                        .executeTakeFirst();
                    ancestor = above?.parent_id ?? null;
                }
                assertNoFolderCycle(params.id, ancestors);
            }
            await trx
                .updateTable("folders")
                .set({ name: next.name, parent_id: next.parent_id, position: next.position, version: next.version })
                .where("id", "=", params.id)
                .execute();
            return mapFolderRow(next);
        }, {
            mapError: (err) => isTransactionConflict(err) ? new CmsError("Cycle", "invalid_input") : mapFolderError(err),
        }),
        /**
         * Deletes a folder. Moves its direct entries and child folders up to the parent. Entries are not deleted.
         * If a moved child folder's name collides in the parent, rejects with 409 so the user renames first.
         */
        deleteFolder: async (params) => withTrx(ctx, async (trx) => {
            const curr = await trx
                .selectFrom("folders")
                .select(["parent_id", "version"])
                .where("id", "=", params.id)
                .forUpdate()
                .executeTakeFirst();
            if (!curr)
                throw new CmsError("Not found", "not_found");
            if (params.expectedVersion !== undefined && curr.version !== params.expectedVersion) {
                throw new CmsError("Conflict", "conflict", curr.version);
            }
            await trx
                .updateTable("folders")
                .set({ parent_id: curr.parent_id })
                .where("parent_id", "=", params.id)
                .execute();
            await trx
                .updateTable("entries")
                .set({ folder_id: curr.parent_id })
                .where("folder_id", "=", params.id)
                .execute();
            await trx.deleteFrom("folders").where("id", "=", params.id).execute();
        }, { mapError: mapFolderError }),
        /** Preview before folder deletion: the number of direct entries and child folders. */
        getFolderContents: async (params) => {
            const [entries, children] = await Promise.all([
                db
                    .selectFrom("entries")
                    .select((eb) => eb.fn.countAll().as("count"))
                    .where("folder_id", "=", params.id)
                    .executeTakeFirst(),
                db
                    .selectFrom("folders")
                    .select(COLUMNS)
                    .where("parent_id", "=", params.id)
                    .orderBy("position", "asc")
                    .orderBy("id", "asc")
                    .execute(),
            ]);
            return { entryCount: Number(entries?.count ?? 0), childFolders: children.map(mapFolderRow) };
        },
        listFolders: async (params) => {
            const rows = await db
                .selectFrom("folders")
                .select(COLUMNS)
                .where("collection", "=", params.collection)
                .orderBy("parent_id", (order) => order.asc().nullsFirst())
                .orderBy("position", "asc")
                .orderBy("id", "asc")
                .execute();
            return rows.map(mapFolderRow);
        },
    };
}
