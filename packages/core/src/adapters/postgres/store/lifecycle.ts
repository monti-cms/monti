import { sql } from "kysely";
import type { PoolClient } from "pg";
import { currentActor } from "../../../core/actor";
import {
	assertArchivable,
	assertDeletable,
	assertRestoreSnapshot,
	assertSourceNotTrashed,
	assertTransitionAllowed,
	blockingTranslations,
	type GroupMember,
	type LifecycleAction,
	membersToArchive,
	membersToRestore,
	membersToTrash,
	membersToUnarchive,
	restorePublishesAgain,
	STATUS_AFTER,
	trashRequiresNoReferences,
} from "../../../core/domain/lifecycle";
import { CmsError } from "../../../core/store/errors";
import type { ContentChangeKind } from "../../../core/store/events";
import type { Entry, EntryStatus } from "../../../core/store/types";
import type { PreparedSnapshot } from "../../../core/types";
import type { Db } from "../db/kysely";
import { type StoreContext, withTrx } from "./context";
import { mapEntryWriteError } from "./errors";
import { recordEvents } from "./events";
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
				await recordEvents(client, qSchema, entry, [kind]);
				return entry;
			},
			{ mapError: mapEntryWriteError },
		);

	/**
	 * For a source, locks and returns the translations in the same group (excluding itself). For a translation, returns an empty list.
	 * A source's status transition applies to the whole group.
	 */
	const lockTranslations = async (trx: Db, id: string): Promise<GroupMember[]> =>
		(
			await trx
				.selectFrom("entries")
				.select(["id", "status", "version", "trashed_at"])
				.where("translation_group_id", "=", id)
				.where("id", "<>", id)
				.orderBy("id")
				.forUpdate()
				.execute()
		).map((row) => ({ id: row.id, status: row.status, trashedAt: row.trashed_at }));

	/**
	 * Changes the translations' status and bumps their version. Editors left open notice it as a conflict.
	 * `trashedAt` also sets (`"now"`) or clears (`null`) the trash time of the translations.
	 */
	const setMembersStatus = async (trx: Db, ids: readonly string[], status: EntryStatus, trashedAt?: "now" | null) => {
		if (ids.length === 0) return;
		await trx
			.updateTable("entries")
			.set({
				status,
				version: sql<number>`version + 1`,
				changed_by: currentActor(),
				changed_at: sql<Date>`now()`,
				...(trashedAt === undefined ? {} : { trashed_at: trashedAt === null ? null : sql<Date>`now()` }),
			})
			.where("id", "=", sql<string>`any(${[...ids]}::uuid[])`)
			.execute();
	};

	/** Slugs that were ever published keep only a reuse-prevention record; reserved slugs are released before the content is deleted. */
	const deleteEntryRow = async (trx: Db, id: string) => {
		await trx.deleteFrom("content_addresses").where("entry_id", "=", id).where("type", "=", "reservation").execute();
		await trx
			.updateTable("content_addresses")
			.set({ type: "deleted", entry_id: null })
			.where("entry_id", "=", id)
			.execute();
		await trx.deleteFrom("entries").where("id", "=", id).execute();
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
				const members = await lockTranslations(trx, params.id);
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
				const members = await lockTranslations(trx, params.id);
				await setMembersStatus(trx, membersToUnarchive(members), STATUS_AFTER.unarchive);
			}),

		/**
		 * To trash. Ends publication.
		 * A category item in use (record collections: tags, categories, etc.) must have its references released first.
		 */
		trashEntry: (params: LifecycleParams) =>
			transition(params, "trash", "trashed", async (trx, client, locked) => {
				if (trashRequiresNoReferences(site, locked.collection)) {
					await publishing.assertNotReferenced(client, params.id, { ignoreTrashedSources: true });
				}
				await trx
					.updateTable("entries")
					.set({
						status: STATUS_AFTER.trash,
						trashed_at: sql<Date>`now()`,
						version: locked.version + 1,
						changed_by: currentActor(),
						changed_at: sql<Date>`now()`,
					})
					.where("id", "=", params.id)
					.execute();
				// now() is the same value within one transaction. On restore, this timestamp finds the "translations trashed together".
				const members = await lockTranslations(trx, params.id);
				await setMembersStatus(trx, membersToTrash(members), STATUS_AFTER.trash, "now");
			}),

		/**
		 * Trash to restore. Publish collections return to draft; record collections are validated for current values and relations
		 * and then returned to active (published) records.
		 */
		restoreEntry: (params: LifecycleParams & { snapshot?: PreparedSnapshot }) =>
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
				const trashedAt = isSource
					? (await trx.selectFrom("entries").select("trashed_at").where("id", "=", params.id).executeTakeFirst())
							?.trashed_at
					: null;
				const version = locked.version + 1;
				await trx
					.updateTable("entries")
					.set({
						status: STATUS_AFTER.restore,
						trashed_at: null,
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
				if (isSource && trashedAt) {
					const members = await lockTranslations(trx, params.id);
					await setMembersStatus(trx, membersToRestore(members, trashedAt), STATUS_AFTER.restore, null);
				}
			}),

		/**
		 * Permanently deletes a trashed entry. Rejected if other content references it.
		 * Slugs that were ever published keep only a reuse-prevention record (`deleted`); reserved slugs that were never published are released.
		 */
		permanentDeleteEntry: async (params: LifecycleParams): Promise<void> =>
			withTrx(ctx, async (trx, client) => {
				const locked = await lockEntryForUpdate(trx, params.id, params.expectedVersion);
				assertDeletable(locked.status, locked.version);
				// The event keeps the entry as it was; it is written after the rows are gone, in the same transaction.
				const last = await loadEntry(trx, params.id);
				await publishing.assertNotReferenced(client, params.id, { ignoreTrashedSources: false });
				// Deleting a source deletes its translations too. Rejected if a translation outside the trash remains, since it would lose its shared values.
				const members = await lockTranslations(trx, params.id);
				const alive = blockingTranslations(members);
				if (alive.length > 0) {
					const translations = await trx
						.selectFrom("entries")
						.select(["id", "locale"])
						.where("id", "=", sql<string>`any(${alive}::uuid[])`)
						.orderBy("locale")
						.execute();
					throw new CmsError("Delete the translations first", "has_translations", locked.version, {
						translations,
					});
				}
				for (const member of members) {
					await publishing.assertNotReferenced(client, member.id, { ignoreTrashedSources: false });
					await deleteEntryRow(trx, member.id);
				}
				await deleteEntryRow(trx, params.id);
				await recordEvents(client, qSchema, last, ["deleted"]);
			}),
	};
}
