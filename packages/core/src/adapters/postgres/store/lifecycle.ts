import { sql } from "kysely";
import type { PoolClient } from "pg";
import { currentActor } from "../../../core/actor";
import {
	assertArchivable,
	assertRestoreSnapshot,
	assertSourceNotTrashed,
	assertTransitionAllowed,
	type LifecycleAction,
	membersToArchive,
	membersToRestore,
	membersToTrash,
	membersToUnarchive,
	restorePublishesAgain,
	STATUS_AFTER,
} from "../../../core/domain/lifecycle";
import type { ContentChangeKind } from "../../../core/store/events";
import type { Entry, EntryStatus } from "../../../core/store/types";
import type { PreparedSnapshot } from "../../../core/types";
import type { Db } from "../db/kysely";
import { type StoreContext, withTrx } from "./context";
import { lockTranslationsOf, removeEntryGroup } from "./entry-removal";
import { mapEntryWriteError } from "./errors";
import { recordEvents } from "./events";
import { placeInLiveFolders } from "./folder-tree";
import type { Publishing } from "./publish";
import { loadEntry, lockEntryForUpdate } from "./rows";

type LifecycleParams = { id: string; expectedVersion: number };

/**
 * Status transitions. Which statuses a transition starts from, and what it does to the translations, is decided by `core/domain/lifecycle`;
 * this module locks the rows, applies the result and keeps the version bumps.
 */
export function createLifecycleOps(ctx: StoreContext, publishing: Publishing) {
	const { qSchema, site } = ctx;

	const transition = (
		params: LifecycleParams,
		action: LifecycleAction,
		kind: ContentChangeKind,
		apply: (
			trx: Db,
			client: PoolClient,
			locked: { version: number; collection: string; status: EntryStatus; translation_group_id: string },
		) => Promise<void>,
	): Promise<Entry> =>
		withTrx(
			ctx,
			async (trx, client) => {
				const locked = await lockEntryForUpdate(trx, params.id, params.expectedVersion);
				assertTransitionAllowed(action, locked.status, locked.version);
				await apply(trx, client, locked);
				const entry = await loadEntry(trx, params.id);
				await recordEvents(client, qSchema, site, entry, [kind]);
				return entry;
			},
			{ mapError: mapEntryWriteError },
		);

	/**
	 * Changes the translations' status and bumps their version. Editors left open notice it as a conflict.
	 * `deletedAt` also sets (`"now"`) or clears (`null`) the trash time of the translations.
	 */
	const setMembersStatus = async (trx: Db, ids: readonly string[], status: EntryStatus, deletedAt?: "now" | null) => {
		if (ids.length === 0) return;
		await trx
			.updateTable("entries")
			.set({
				status,
				version: sql<number>`version + 1`,
				changed_by: currentActor(),
				changed_at: sql<Date>`now()`,
				...(deletedAt === undefined ? {} : { deleted_at: deletedAt === null ? null : sql<Date>`now()` }),
			})
			.where("id", "=", sql<string>`any(${[...ids]}::uuid[])`)
			.execute();
	};

	return {
		/** Draft/published to archived. Ends publication. Record collections have no archive. */
		archiveEntry: (params: LifecycleParams) =>
			transition(params, "archive", "archived", async (trx, _client, locked) => {
				assertArchivable(site, locked.collection, locked.version);
				await trx
					.updateTable("entries")
					.set({
						status: STATUS_AFTER.archive,
						version: locked.version + 1,
						changed_by: currentActor(),
						changed_at: sql<Date>`now()`,
					})
					.where("id", "=", params.id)
					.execute();
				const members = await lockTranslationsOf(trx, params.id);
				await setMembersStatus(trx, membersToArchive(members), STATUS_AFTER.archive);
			}),

		/** Archived to draft. Does not republish automatically. */
		unarchiveEntry: (params: LifecycleParams) =>
			transition(params, "unarchive", "unarchived", async (trx, _client, locked) => {
				await trx
					.updateTable("entries")
					.set({
						status: STATUS_AFTER.unarchive,
						version: locked.version + 1,
						changed_by: currentActor(),
						changed_at: sql<Date>`now()`,
					})
					.where("id", "=", params.id)
					.execute();
				const members = await lockTranslationsOf(trx, params.id);
				await setMembersStatus(trx, membersToUnarchive(members), STATUS_AFTER.unarchive);
			}),

		/** To trash. Ends publication. An entry in use goes too (an item such as a tag included); only the permanent delete is held back by what points at it. */
		trashEntry: (params: LifecycleParams) =>
			transition(params, "trash", "trashed", async (trx, _client, locked) => {
				await trx
					.updateTable("entries")
					.set({
						status: STATUS_AFTER.trash,
						deleted_at: sql<Date>`now()`,
						version: locked.version + 1,
						changed_by: currentActor(),
						changed_at: sql<Date>`now()`,
					})
					.where("id", "=", params.id)
					.execute();
				// now() is the same value within one transaction. On restore, this timestamp finds the "translations trashed together".
				const members = await lockTranslationsOf(trx, params.id);
				await setMembersStatus(trx, membersToTrash(members), STATUS_AFTER.trash, "now");
			}),

		/**
		 * Trash to restore. Publish collections return to draft; record collections are validated for current values and relations
		 * and then returned to active (published) records.
		 */
		restoreEntry: (
			params: LifecycleParams & {
				snapshot?: PreparedSnapshot;
				/** Called when the entry came back from a trashed folder: into the live folder of the same path, made again where it was missing (`recreated`). */
				onPlaced?: (placed: { recreated: boolean }) => void;
			},
		) =>
			transition(params, "restore", "restored", async (trx, client, locked) => {
				const isSource = locked.translation_group_id === params.id;
				if (!isSource) {
					const source = await trx
						.selectFrom("entries")
						.select("status")
						.where("id", "=", locked.translation_group_id)
						.executeTakeFirst();
					assertSourceNotTrashed(source?.status, locked.version);
				}
				const deletedAt = isSource
					? (await trx.selectFrom("entries").select("deleted_at").where("id", "=", params.id).executeTakeFirst())
							?.deleted_at
					: null;
				const version = locked.version + 1;
				await trx
					.updateTable("entries")
					.set({
						status: STATUS_AFTER.restore,
						deleted_at: null,
						version,
						changed_by: currentActor(),
						changed_at: sql<Date>`now()`,
					})
					.where("id", "=", params.id)
					.execute();
				if (restorePublishesAgain(site, locked.collection)) {
					// A record is published again on restore, so the service passes the prepared draft.
					assertRestoreSnapshot(params.snapshot);
					await publishing.publishWithinTransaction(client, params.id, {
						expectedVersion: version,
						snapshot: params.snapshot as PreparedSnapshot,
					});
				}
				const restored = [params.id];
				if (isSource && deletedAt) {
					const members = await lockTranslationsOf(trx, params.id);
					const withSource = membersToRestore(members, deletedAt);
					await setMembersStatus(trx, withSource, STATUS_AFTER.restore, null);
					restored.push(...withSource);
				}
				// An entry that was in a trashed folder comes back to the live folder of the same path.
				const placed = await placeInLiveFolders(trx, "entries", restored);
				if (placed.placed) params.onPlaced?.({ recreated: placed.recreated });
			}),

		/**
		 * Permanently deletes a trashed entry, and its translations with it. Rejected when an entry outside them points at it from a relation field
		 * (`in_use`, with those entries); a link in a body does not hold it back, its reference is removed with the entry.
		 * Slugs that were ever published keep only a reuse-prevention record (`deleted`); reserved slugs that were never published are released.
		 */
		permanentDeleteEntry: async (params: LifecycleParams): Promise<void> => {
			await withTrx(ctx, (trx, client) => removeEntryGroup(ctx, trx, client, params));
		},
	};
}
