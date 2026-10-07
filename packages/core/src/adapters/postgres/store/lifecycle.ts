import type { PoolClient } from "pg";
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
import { type StoreContext, withTransaction } from "./context";
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
	const { pool, qSchema, site } = ctx;

	const transition = (
		params: LifecycleParams,
		action: LifecycleAction,
		kind: ContentChangeKind,
		apply: (
			client: PoolClient,
			locked: { version: number; collection: string; status: EntryStatus; translation_group_id: string },
		) => Promise<void>,
	): Promise<Entry> =>
		withTransaction(
			pool,
			async (client) => {
				const locked = await lockEntryForUpdate(client, qSchema, params.id, params.expectedVersion);
				assertTransitionAllowed(action, locked.status, locked.version);
				await apply(client, locked);
				const entry = await loadEntry(client, params.id, qSchema);
				await recordEvents(client, qSchema, entry, [kind]);
				return entry;
			},
			{ mapError: mapEntryWriteError },
		);

	/**
	 * For a source, locks and returns the translations in the same group (excluding itself). For a translation, returns an empty list.
	 * A source's status transition applies to the whole group.
	 */
	const lockTranslations = async (client: PoolClient, id: string): Promise<GroupMember[]> =>
		(
			await client.query<{ id: string; status: EntryStatus; version: number; trashed_at: Date | null }>(
				`SELECT id, status, version, trashed_at FROM "${qSchema}".entries
				 WHERE translation_group_id = $1 AND id <> $1 ORDER BY id FOR UPDATE`,
				[id],
			)
		).rows.map((row) => ({ id: row.id, status: row.status, trashedAt: row.trashed_at }));

	/** Changes the translations' status and bumps their version. Editors left open notice it as a conflict. */
	const setMembersStatus = async (client: PoolClient, ids: readonly string[], status: EntryStatus, extra = "") => {
		if (ids.length === 0) return;
		await client.query(
			`UPDATE "${qSchema}".entries SET status = $1, version = version + 1${extra} WHERE id = ANY($2::uuid[])`,
			[status, ids],
		);
	};

	/** Slugs that were ever published keep only a reuse-prevention record; reserved slugs are released before the content is deleted. */
	const deleteEntryRow = async (client: PoolClient, id: string) => {
		await client.query(`DELETE FROM "${qSchema}".content_addresses WHERE entry_id = $1 AND type = 'reservation'`, [id]);
		await client.query(
			`UPDATE "${qSchema}".content_addresses SET type = 'deleted', entry_id = NULL WHERE entry_id = $1`,
			[id],
		);
		await client.query(`DELETE FROM "${qSchema}".entries WHERE id = $1`, [id]);
	};

	return {
		/** Draft/published to archived. Ends publication. Record collections have no archive. */
		archiveEntry: (params: LifecycleParams) =>
			transition(params, "archive", "archived", async (client, locked) => {
				assertArchivable(site, locked.collection, locked.version);
				await client.query(`UPDATE "${qSchema}".entries SET status = $1, version = $2 WHERE id = $3`, [
					STATUS_AFTER.archive,
					locked.version + 1,
					params.id,
				]);
				const members = await lockTranslations(client, params.id);
				await setMembersStatus(client, membersToArchive(members), STATUS_AFTER.archive);
			}),

		/** Archived to draft. Does not republish automatically. */
		unarchiveEntry: (params: LifecycleParams) =>
			transition(params, "unarchive", "unarchived", async (client, locked) => {
				await client.query(`UPDATE "${qSchema}".entries SET status = $1, version = $2 WHERE id = $3`, [
					STATUS_AFTER.unarchive,
					locked.version + 1,
					params.id,
				]);
				const members = await lockTranslations(client, params.id);
				await setMembersStatus(client, membersToUnarchive(members), STATUS_AFTER.unarchive);
			}),

		/**
		 * To trash. Ends publication.
		 * A category item in use (record collections: tags, categories, etc.) must have its references released first.
		 */
		trashEntry: (params: LifecycleParams) =>
			transition(params, "trash", "trashed", async (client, locked) => {
				if (trashRequiresNoReferences(site, locked.collection)) {
					await publishing.assertNotReferenced(client, params.id, { ignoreTrashedSources: true });
				}
				await client.query(
					`UPDATE "${qSchema}".entries SET status = $1, trashed_at = NOW(), version = $2 WHERE id = $3`,
					[STATUS_AFTER.trash, locked.version + 1, params.id],
				);
				// NOW() is the same value within one transaction. On restore, this timestamp finds the "translations trashed together".
				const members = await lockTranslations(client, params.id);
				await setMembersStatus(client, membersToTrash(members), STATUS_AFTER.trash, ", trashed_at = NOW()");
			}),

		/**
		 * Trash to restore. Publish collections return to draft; record collections are validated for current values and relations
		 * and then returned to active (published) records.
		 */
		restoreEntry: (params: LifecycleParams & { snapshot?: PreparedSnapshot }) =>
			transition(params, "restore", "restored", async (client, locked) => {
				const isSource = locked.translation_group_id === params.id;
				if (!isSource) {
					const source = await client.query<{ status: EntryStatus }>(
						`SELECT status FROM "${qSchema}".entries WHERE id = $1`,
						[locked.translation_group_id],
					);
					assertSourceNotTrashed(source.rows[0]?.status, locked.version);
				}
				const trashedAt = isSource
					? (
							await client.query<{ trashed_at: Date | null }>(
								`SELECT trashed_at FROM "${qSchema}".entries WHERE id = $1`,
								[params.id],
							)
						).rows[0]?.trashed_at
					: null;
				const version = locked.version + 1;
				await client.query(
					`UPDATE "${qSchema}".entries SET status = $1, trashed_at = NULL, version = $2 WHERE id = $3`,
					[STATUS_AFTER.restore, version, params.id],
				);
				if (restorePublishesAgain(site, locked.collection)) {
					// A record is published again on restore, so the service passes the prepared draft.
					assertRestoreSnapshot(params.snapshot);
					await publishing.publishWithinTransaction(client, params.id, {
						expectedVersion: version,
						snapshot: params.snapshot as PreparedSnapshot,
					});
				}
				if (isSource && trashedAt) {
					const members = await lockTranslations(client, params.id);
					await setMembersStatus(
						client,
						membersToRestore(members, trashedAt),
						STATUS_AFTER.restore,
						", trashed_at = NULL",
					);
				}
			}),

		/**
		 * Permanently deletes a trashed entry. Rejected if other content references it.
		 * Slugs that were ever published keep only a reuse-prevention record (`deleted`); reserved slugs that were never published are released.
		 */
		permanentDeleteEntry: async (params: LifecycleParams): Promise<void> =>
			withTransaction(pool, async (client) => {
				const locked = await lockEntryForUpdate(client, qSchema, params.id, params.expectedVersion);
				assertDeletable(locked.status, locked.version);
				// The event keeps the entry as it was; it is written after the rows are gone, in the same transaction.
				const last = await loadEntry(client, params.id, qSchema);
				await publishing.assertNotReferenced(client, params.id, { ignoreTrashedSources: false });
				// Deleting a source deletes its translations too. Rejected if a translation outside the trash remains, since it would lose its shared values.
				const members = await lockTranslations(client, params.id);
				const alive = blockingTranslations(members);
				if (alive.length > 0) {
					const translations = await client.query<{ id: string; locale: string }>(
						`SELECT id, locale FROM "${qSchema}".entries WHERE id = ANY($1::uuid[]) ORDER BY locale`,
						[alive],
					);
					throw new CmsError("Delete the translations first", "has_translations", locked.version, {
						translations: translations.rows,
					});
				}
				for (const member of members) {
					await publishing.assertNotReferenced(client, member.id, { ignoreTrashedSources: false });
					await deleteEntryRow(client, member.id);
				}
				await deleteEntryRow(client, params.id);
				await recordEvents(client, qSchema, last, ["deleted"]);
			}),
	};
}
