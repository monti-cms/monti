import { sql } from "kysely";
import type { PoolClient } from "pg";
import { currentActor } from "../../../core/actor";
import { MEDIA_FOLDER_SCOPE } from "../../../core/collections";
import { assertFoldersEnabled } from "../../../core/domain/folders";
import { assertRestoreSnapshot, restorePublishesAgain } from "../../../core/domain/lifecycle";
import {
	blockingMediaUsages,
	entriesToTrash,
	foldersToTrash,
	mediaToTrash,
	nextTrashStamp,
	planMediaFolderTrash,
	restoredWith,
} from "../../../core/domain/trash";
import { CmsError } from "../../../core/store/errors";
import type {
	DeleteTrashedOutcome,
	FolderRestoreOutcome,
	FolderTrashOutcome,
	TrashListRead,
	TrashUnit,
} from "../../../core/store/trash";
import type { MediaAssetRecord } from "../../../core/store/types";
import type {
	MediaTrashResult,
	TrashDeleteResult,
	TrashListParams,
	TrashTarget,
	TrashUsage,
} from "../../../core/trash";
import type { PreparedSnapshot } from "../../../core/types";
import type { Db } from "../db/kysely";
import { type StoreContext, withTrx } from "./context";
import { referrersOf, removeEntries, removeEntryGroup } from "./entry-removal";
import { mapEntryWriteError } from "./errors";
import { recordEvents } from "./events";
import {
	ensureLivePath,
	type FolderNode,
	findFolder,
	findLiveSibling,
	placeInLiveFolders,
	subtreeOf,
} from "./folder-tree";
import { mediaInUse } from "./media-use";
import type { Publishing } from "./publish";
import { loadEntry, MEDIA_COLUMN_NAMES, mapMediaRow } from "./rows";
import { createTrashReads } from "./trash-list";

/** The database clock, to the millisecond (the precision of a stamp). */
const databaseNow = async (trx: Db): Promise<Date> => {
	const row = await sql<{ now: Date }>`select now() as now`.execute(trx);
	return row.rows[0]?.now ?? new Date();
};

const latest = (...groups: readonly (readonly (Date | null)[])[]): (Date | null)[] => groups.flat();

/** A folder row as the trash rules read it. */
const asStamp = (folder: FolderNode) => ({ id: folder.id, deletedAt: folder.deleted_at });

const anyOf = (ids: readonly string[]) => sql<string>`any(${[...ids]}::uuid[])`;

interface EntryRow {
	id: string;
	collection: string;
	status: "draft" | "published" | "archived" | "trashed";
	deleted_at: Date | null;
	translation_group_id: string | null;
	version: number;
	folder_id: string | null;
}

const ENTRY_COLUMNS = [
	"id",
	"collection",
	"status",
	"deleted_at",
	"translation_group_id",
	"version",
	"folder_id",
] as const;

/** The trash: discarding folders and media, putting them back, the list, deleting for good, and unlinking. */
export function createTrashOps(ctx: StoreContext, publishing: Publishing) {
	const { site, qSchema } = ctx;
	const db = ctx.db();
	const reads = createTrashReads(ctx);

	const isTranslation = (entry: Pick<EntryRow, "id" | "translation_group_id">) =>
		entry.translation_group_id !== null && entry.translation_group_id !== entry.id;

	/** Locks a folder and checks its version. */
	const lockFolder = async (trx: Db, id: string, expectedVersion?: number): Promise<FolderNode> => {
		const folder = await trx
			.selectFrom("folders")
			.select(["id", "collection", "parent_id", "name", "position", "version", "deleted_at"])
			.where("id", "=", id)
			.forUpdate()
			.executeTakeFirst();
		if (!folder) throw new CmsError("Not found", "not_found");
		if (expectedVersion !== undefined && folder.version !== expectedVersion) {
			throw new CmsError("Conflict", "conflict", { serverVersion: folder.version });
		}
		return folder;
	};

	const stampFolders = async (trx: Db, ids: readonly string[], stamp: Date) => {
		if (ids.length === 0) return;
		await trx
			.updateTable("folders")
			.set({ deleted_at: stamp, version: sql<number>`version + 1` })
			.where("id", "=", anyOf(ids))
			.execute();
	};

	const stampMedia = async (trx: Db, ids: readonly string[], stamp: Date) => {
		if (ids.length === 0) return;
		await trx
			.updateTable("media_assets")
			.set({ status: "trashed", deleted_at: stamp, updated_at: sql<Date>`now()` })
			.where("id", "=", anyOf(ids))
			.execute();
	};

	/** What a folder restore brings back, found without changing anything: the folders that came with it and the entries that can come back. */
	const restoreScope = async (trx: Db, root: FolderNode, forUpdate: boolean) => {
		const stamp = root.deleted_at as Date;
		const subtree = await subtreeOf(trx, qSchema, root.id);
		// The folders of the same action, reached from the root through folders of the same action.
		const byParent = new Map<string | null, FolderNode[]>();
		for (const folder of subtree) byParent.set(folder.parent_id, [...(byParent.get(folder.parent_id) ?? []), folder]);
		const stamped: FolderNode[] = [root];
		for (let at = 0; at < stamped.length; at += 1) {
			const children = restoredWith(
				(byParent.get((stamped[at] as FolderNode).id) ?? []).map((folder) => ({
					...folder,
					deletedAt: folder.deleted_at,
				})),
				stamp,
			);
			stamped.push(...children);
		}
		const folderIds = stamped.map((folder) => folder.id);
		const isMedia = root.collection === MEDIA_FOLDER_SCOPE;
		if (isMedia) {
			const files = await trx
				.selectFrom("media_assets")
				.select(["id", "folder_id", "deleted_at"])
				.where("folder_id", "=", anyOf(folderIds))
				.where("status", "=", "trashed")
				.orderBy("id")
				.$if(forUpdate, (qb) => qb.forUpdate())
				.execute();
			const mine = restoredWith(
				files.map((file) => ({ ...file, deletedAt: file.deleted_at })),
				stamp,
			);
			return {
				stamped,
				entries: [] as EntryRow[],
				files: mine.map((file) => ({ id: file.id, folderId: file.folder_id })),
			};
		}
		const candidates = await trx
			.selectFrom("entries")
			.select(ENTRY_COLUMNS)
			.where("folder_id", "=", anyOf(folderIds))
			.where("status", "=", "trashed")
			.orderBy("id")
			.$if(forUpdate, (qb) => qb.forUpdate())
			.execute();
		const together = restoredWith(
			candidates.map((entry) => ({ ...entry, deletedAt: entry.deleted_at })),
			stamp,
		);
		// A translation whose source stays in the trash cannot come back before it.
		const coming = new Set(together.map((entry) => entry.id));
		const sourceIds = together.filter(isTranslation).map((entry) => entry.translation_group_id as string);
		const outside = sourceIds.filter((id) => !coming.has(id));
		const outsideRows = outside.length
			? await trx.selectFrom("entries").select(["id", "status"]).where("id", "=", anyOf(outside)).execute()
			: [];
		const stillTrashed = new Set(outsideRows.filter((row) => row.status === "trashed").map((row) => row.id));
		const entries = together.filter(
			(entry) => !isTranslation(entry) || !stillTrashed.has(entry.translation_group_id as string),
		);
		return { stamped, entries: entries as EntryRow[], files: [] as { id: string; folderId: string | null }[] };
	};

	/** Restores one folder (and what came with it) into `liveParent`, merging into a live folder of the same name. Returns where the folder's content went. */
	const restoreInto = async (
		trx: Db,
		folder: FolderNode,
		liveParent: string | null,
		stamped: ReadonlySet<string>,
		targets: Map<string, string>,
		merged: FolderNode[],
		children: Map<string | null, FolderNode[]>,
	): Promise<void> => {
		const existing = await findLiveSibling(trx, folder.collection, liveParent, folder.name);
		let target: string;
		if (existing && existing.id !== folder.id) {
			target = existing.id;
			merged.push({ ...folder, parent_id: liveParent });
		} else {
			target = folder.id;
			await trx
				.updateTable("folders")
				.set({ deleted_at: null, parent_id: liveParent, version: sql<number>`version + 1` })
				.where("id", "=", folder.id)
				.execute();
		}
		targets.set(folder.id, target);
		for (const child of children.get(folder.id) ?? []) {
			if (stamped.has(child.id)) await restoreInto(trx, child, target, stamped, targets, merged, children);
		}
	};

	/** The version an entry that comes back leaves with: the next one. */
	const restoreEntryRows = async (
		trx: Db,
		client: PoolClient,
		entries: readonly EntryRow[],
		folderOf: (entry: EntryRow) => string | null,
		snapshots: ReadonlyMap<string, PreparedSnapshot> | undefined,
	) => {
		for (const entry of entries) {
			await trx
				.updateTable("entries")
				.set({
					status: "draft",
					deleted_at: null,
					folder_id: folderOf(entry),
					version: entry.version + 1,
					changed_by: currentActor(),
					changed_at: sql<Date>`now()`,
				})
				.where("id", "=", entry.id)
				.execute();
		}
		for (const entry of entries) {
			if (!restorePublishesAgain(site, entry.collection)) continue;
			// A record is published again on restore, with its prepared draft.
			const snapshot = snapshots?.get(entry.id);
			assertRestoreSnapshot(snapshot);
			await publishing.publishWithinTransaction(client, entry.id, {
				expectedVersion: entry.version + 1,
				snapshot: snapshot as PreparedSnapshot,
			});
		}
		for (const entry of entries) {
			await recordEvents(client, qSchema, site, await loadEntry(trx, entry.id), ["restored"]);
		}
	};

	/** The media files in use, among `ids`. */
	const inUseAmong = (trx: Db, ids: readonly string[]) => mediaInUse(trx, qSchema, ids);

	/** A unit deleted for good: what the database did, and the media files whose stored files are left to delete. */
	interface UnitRemoval {
		readonly files: MediaAssetRecord[];
		readonly entryIds: string[];
		/** Every entry, folder and media file the removal took, so a unit that went with an earlier one is not tried again. */
		readonly gone: string[];
	}

	/** Deletes one trashed unit inside the transaction. Throws `in_use` (with the entries) when something outside it points at it. */
	const removeUnit = async (trx: Db, client: PoolClient, target: TrashTarget): Promise<UnitRemoval> => {
		if (target.type === "entry") {
			const removed = await removeEntryGroup(ctx, trx, client, {
				id: target.id,
				expectedVersion: target.expectedVersion,
			});
			const entryIds = removed.map((entry) => entry.id);
			return { files: [], entryIds, gone: entryIds };
		}
		if (target.type === "media") {
			const row = await trx
				.selectFrom("media_assets")
				.select(MEDIA_COLUMN_NAMES)
				.where("id", "=", target.id)
				.forUpdate()
				.executeTakeFirst();
			if (!row) throw new CmsError("Media asset not found", "not_found");
			if (row.status !== "trashed") {
				throw new CmsError("Only trashed files can be permanently deleted", "invalid_status");
			}
			const usages = blockingMediaUsages(await referrersOf(trx, ctx, { media: [target.id] }), new Set());
			if (usages.length > 0) throw new CmsError("Entries still use this file", "in_use", { details: { usages } });
			// The row stays (still `trashed`) until the stored files are deleted, out of its folder so the folder can go.
			await trx.updateTable("media_assets").set({ folder_id: null }).where("id", "=", target.id).execute();
			return { files: [mapMediaRow({ ...row, folder_id: null })], entryIds: [], gone: [target.id] };
		}
		const root = await lockFolder(trx, target.id, target.expectedVersion);
		if (root.deleted_at === null)
			throw new CmsError("Only trashed folders can be permanently deleted", "invalid_status");
		const subtree = await subtreeOf(trx, qSchema, root.id);
		const folderIds = subtree.map((folder) => folder.id);
		const inFolders = anyOf(folderIds);
		const entryRows = await trx
			.selectFrom("entries")
			.select(ENTRY_COLUMNS)
			.where("folder_id", "=", inFolders)
			.orderBy("id")
			.forUpdate()
			.execute();
		if (entryRows.some((entry) => entry.status !== "trashed")) {
			throw new CmsError("Only trashed entries can be permanently deleted", "invalid_status");
		}
		// A source goes with its translations, wherever they are; one outside the trash holds the source back.
		const inside = new Set(entryRows.map((entry) => entry.id));
		const sources = entryRows.filter((entry) => !isTranslation(entry)).map((entry) => entry.id);
		const elsewhere = sources.length
			? await trx
					.selectFrom("entries")
					.select(["id", "status", "locale"])
					.where("translation_group_id", "=", anyOf(sources))
					.where("id", "<>", sql<string>`translation_group_id`)
					.orderBy("id")
					.forUpdate()
					.execute()
			: [];
		const outsideMembers = elsewhere.filter((member) => !inside.has(member.id));
		const alive = outsideMembers.filter((member) => member.status !== "trashed");
		if (alive.length > 0) {
			throw new CmsError("Delete the translations first", "has_translations", {
				details: { translations: alive.map(({ id, locale }) => ({ id, locale })) },
			});
		}
		const entryIds = [...outsideMembers.map((member) => member.id), ...entryRows.map((entry) => entry.id)];
		const files = await trx
			.selectFrom("media_assets")
			.select(MEDIA_COLUMN_NAMES)
			.where("folder_id", "=", inFolders)
			.orderBy("id")
			.forUpdate()
			.execute();
		const stored = files.filter((file) => file.status === "trashed" || file.status === "ready");
		const mediaUsages = blockingMediaUsages(
			await referrersOf(trx, ctx, { media: stored.map((file) => file.id) }),
			new Set(entryIds),
		);
		if (mediaUsages.length > 0) {
			throw new CmsError("Entries still use a file in this folder", "in_use", { details: { usages: mediaUsages } });
		}
		const removed = await removeEntries(ctx, trx, client, entryIds);
		// The files stay (still `trashed`) until their stored files are deleted, out of the folders so the folders can go; an unfinished upload is left unfiled.
		await trx.updateTable("media_assets").set({ folder_id: null }).where("folder_id", "=", inFolders).execute();
		await trx
			.updateTable("media_assets")
			.set({ status: "trashed", deleted_at: root.deleted_at })
			.where("id", "=", anyOf(stored.filter((file) => file.status === "ready").map((file) => file.id)))
			.execute();
		await trx.deleteFrom("folders").where("id", "=", inFolders).execute();
		const removedIds = removed.map((entry) => entry.id);
		return {
			files: stored.map((file) => mapMediaRow({ ...file, status: "trashed", folder_id: null })),
			entryIds: removedIds,
			gone: [...folderIds, ...removedIds, ...stored.map((file) => file.id)],
		};
	};

	const resultOf = (target: TrashTarget, error: unknown): TrashDeleteResult => {
		const cms = error instanceof CmsError ? error : undefined;
		const usages = (cms?.details as { usages?: readonly TrashUsage[] } | undefined)?.usages;
		return {
			type: target.type,
			id: target.id,
			ok: false,
			error: cms?.code ?? "internal",
			...(usages && usages.length > 0 ? { usages } : {}),
		};
	};

	return {
		/**
		 * Discards a folder with everything in it as one unit. An entry folder always goes whole. A media folder goes whole unless a file in it is in use;
		 * then only the unused files go, each on its own, and the folder stays.
		 */
		trashFolder: async (params: { id: string; expectedVersion?: number }): Promise<FolderTrashOutcome> => {
			const outcome = await withTrx(
				ctx,
				async (trx, client) => {
					const root = await lockFolder(trx, params.id, params.expectedVersion);
					if (root.deleted_at !== null) throw new CmsError("Not found", "not_found");
					assertFoldersEnabled(site, root.collection);
					const subtree = await subtreeOf(trx, qSchema, root.id);
					const folderIds = subtree.map((folder) => folder.id);
					const inFolders = anyOf(folderIds);
					const now = await databaseNow(trx);
					const subfolders = subtree.length - 1;

					if (root.collection === MEDIA_FOLDER_SCOPE) {
						const files = await trx
							.selectFrom("media_assets")
							.select(["id", "status", "deleted_at"])
							.where("folder_id", "=", inFolders)
							.orderBy("id")
							.forUpdate()
							.execute();
						const ready = mediaToTrash(files);
						const plan = planMediaFolderTrash(ready, await inUseAmong(trx, ready));
						const stamp = nextTrashStamp(
							now,
							latest(
								subtree.map((folder) => folder.deleted_at),
								files.map((file) => file.deleted_at),
							),
						);
						await stampMedia(trx, plan.trash, stamp);
						if (plan.whole) await stampFolders(trx, foldersToTrash(subtree.map(asStamp)), stamp);
						return {
							whole: plan.whole,
							entries: 0,
							folders: plan.whole ? subfolders : 0,
							files: plan.trash.length,
							kept: plan.kept.length,
							entryIds: [] as string[],
						};
					}

					const entries = await trx
						.selectFrom("entries")
						.select(ENTRY_COLUMNS)
						.where("folder_id", "=", inFolders)
						.orderBy("id")
						.forUpdate()
						.execute();
					const taking = entriesToTrash(entries);
					const stamp = nextTrashStamp(
						now,
						latest(
							subtree.map((folder) => folder.deleted_at),
							entries.map((entry) => entry.deleted_at),
						),
					);
					if (taking.length > 0) {
						await trx
							.updateTable("entries")
							.set({
								status: "trashed",
								deleted_at: stamp,
								version: sql<number>`version + 1`,
								changed_by: currentActor(),
								changed_at: sql<Date>`now()`,
							})
							.where("id", "=", anyOf(taking))
							.execute();
					}
					await stampFolders(trx, foldersToTrash(subtree.map(asStamp)), stamp);
					for (const id of taking) await recordEvents(client, qSchema, site, await loadEntry(trx, id), ["trashed"]);
					const taken = new Set(taking);
					const groups = new Set(
						entries.filter((entry) => taken.has(entry.id)).map((entry) => entry.translation_group_id ?? entry.id),
					);
					return { whole: true, entries: groups.size, folders: subfolders, files: 0, kept: 0, entryIds: taking };
				},
				{ mapError: mapEntryWriteError },
			);
			const folder = outcome.whole ? ((await reads.readFolderItems([params.id])).get(params.id) ?? null) : null;
			return {
				folder,
				entries: outcome.entries,
				folders: outcome.folders,
				files: outcome.files,
				kept: outcome.kept,
				entryIds: outcome.entryIds,
			};
		},

		/** The entries a restore of this trashed folder would bring back (an item among them is published again, so the caller prepares its draft). */
		folderRestoreEntries: async (params: { id: string }): Promise<{ id: string; collection: string }[]> => {
			const root = await findFolder(db, params.id);
			if (!root || root.deleted_at === null) throw new CmsError("Not found", "not_found");
			const scope = await restoreScope(db, root, false);
			return scope.entries.map((entry) => ({ id: entry.id, collection: entry.collection }));
		},

		/**
		 * Puts a trashed folder back, with what was discarded with it (the same stamp); what was discarded earlier stays in the trash. It goes back where it was,
		 * made again up its path if needed, and merges into a live folder of the same name. Entries come back as drafts, an item published again with its
		 * prepared draft (`snapshots`, from `folderRestoreEntries`).
		 */
		restoreFolder: async (params: {
			id: string;
			expectedVersion?: number;
			snapshots?: ReadonlyMap<string, PreparedSnapshot>;
		}): Promise<FolderRestoreOutcome> =>
			withTrx(
				ctx,
				async (trx, client) => {
					const root = await lockFolder(trx, params.id, params.expectedVersion);
					if (root.deleted_at === null) throw new CmsError("Not in the trash", "invalid_status");
					const live = await ensureLivePath(trx, root.parent_id);
					const scope = await restoreScope(trx, root, true);
					const stamped = new Set(scope.stamped.map((folder) => folder.id));
					const children = new Map<string | null, FolderNode[]>();
					for (const folder of scope.stamped) {
						children.set(folder.parent_id, [...(children.get(folder.parent_id) ?? []), folder]);
					}
					const targets = new Map<string, string>();
					const merged: FolderNode[] = [];
					await restoreInto(trx, root, live.id, stamped, targets, merged, children);

					const targetOf = (folderId: string | null) => (folderId ? (targets.get(folderId) ?? folderId) : null);
					await restoreEntryRows(trx, client, scope.entries, (entry) => targetOf(entry.folder_id), params.snapshots);
					for (const file of scope.files) {
						await trx
							.updateTable("media_assets")
							.set({
								status: "ready",
								deleted_at: null,
								folder_id: targetOf(file.folderId),
								updated_at: sql<Date>`now()`,
							})
							.where("id", "=", file.id)
							.execute();
					}

					// A folder that was merged away goes when nothing is left in it; otherwise it stays in the trash with what is left, at the top.
					for (const folder of merged.reverse()) {
						// One query after the other: they share the transaction's connection.
						const subfolders = await trx
							.selectFrom("folders")
							.select("id")
							.where("parent_id", "=", folder.id)
							.limit(1)
							.execute();
						const entries = await trx
							.selectFrom("entries")
							.select("id")
							.where("folder_id", "=", folder.id)
							.limit(1)
							.execute();
						const files = await trx
							.selectFrom("media_assets")
							.select("id")
							.where("folder_id", "=", folder.id)
							.limit(1)
							.execute();
						if (subfolders.length + entries.length + files.length === 0) {
							await trx.deleteFrom("folders").where("id", "=", folder.id).execute();
						} else {
							await trx
								.updateTable("folders")
								.set({ parent_id: folder.parent_id })
								.where("id", "=", folder.id)
								.execute();
						}
					}
					return {
						folderId: targets.get(root.id) as string,
						recreated: live.recreated,
						entryIds: scope.entries.map((entry) => entry.id),
					};
				},
				{ mapError: mapEntryWriteError },
			),

		/** Discards media files. Those in use stay (`kept`). */
		trashMedia: async (params: { ids: readonly string[] }): Promise<MediaTrashResult> =>
			withTrx(ctx, async (trx) => {
				if (params.ids.length === 0) return { trashed: [], kept: [] };
				const rows = await trx
					.selectFrom("media_assets")
					.select(["id", "status"])
					.where("id", "=", anyOf(params.ids))
					.orderBy("id")
					.forUpdate()
					.execute();
				const ready = new Set(mediaToTrash(rows));
				const used = await inUseAmong(trx, [...ready]);
				const asked = params.ids.filter((id) => ready.has(id));
				const trashed = asked.filter((id) => !used.has(id));
				await stampMedia(trx, trashed, nextTrashStamp(await databaseNow(trx), []));
				return { trashed, kept: asked.filter((id) => used.has(id)) };
			}),

		/** Puts a trashed media file back in its folder, made again where it is in the trash. */
		restoreMedia: async (params: { id: string }): Promise<{ media: MediaAssetRecord; recreated: boolean }> =>
			withTrx(ctx, async (trx) => {
				const row = await trx
					.selectFrom("media_assets")
					.select(["id", "status"])
					.where("id", "=", params.id)
					.forUpdate()
					.executeTakeFirst();
				if (!row) throw new CmsError("Media asset not found", "not_found");
				if (row.status !== "trashed") throw new CmsError("Not in the trash", "invalid_status");
				await trx
					.updateTable("media_assets")
					.set({ status: "ready", deleted_at: null, updated_at: sql<Date>`now()` })
					.where("id", "=", params.id)
					.execute();
				const placed = await placeInLiveFolders(trx, "media_assets", [params.id]);
				const media = await trx
					.selectFrom("media_assets")
					.select(MEDIA_COLUMN_NAMES)
					.where("id", "=", params.id)
					.executeTakeFirstOrThrow();
				return { media: mapMediaRow(media), recreated: placed.recreated };
			}),

		listTrash: (params: TrashListParams): Promise<TrashListRead> => reads.listTrash(params),

		/** The units at the top of the trash with the day each was discarded, for emptying and the purge. */
		listTrashUnits: async (): Promise<TrashUnit[]> =>
			(await reads.topUnits()).map((unit) => ({
				type: unit.type,
				id: unit.id,
				...(unit.type === "media" || unit.version === null ? {} : { expectedVersion: unit.version }),
				title: unit.title,
				deletedAt: unit.effective_at,
			})),

		/**
		 * Deletes trashed units for good. A unit that something outside it points at from a relation field stays (`in_use`, with those entries); one that was held
		 * back by an entry deleted later in the same request is tried again once the others are done. A body link never holds back: its reference goes with the entry.
		 */
		deleteTrashed: async (params: { targets: readonly TrashTarget[] }): Promise<DeleteTrashedOutcome> => {
			const results = new Map<number, TrashDeleteResult>();
			const files: { index: number; media: MediaAssetRecord }[] = [];
			const entryIds: string[] = [];
			// A unit that an earlier one took with it (a translation with its source, a subfolder or a file with its folder) is deleted too.
			const gone = new Set<string>();
			let pending = params.targets.map((_, index) => index);
			while (pending.length > 0) {
				const blocked: number[] = [];
				let progressed = false;
				for (const index of pending) {
					const target = params.targets[index] as TrashTarget;
					if (gone.has(target.id)) {
						results.set(index, { type: target.type, id: target.id, ok: true });
						continue;
					}
					try {
						const removal = await withTrx(ctx, (trx, client) => removeUnit(trx, client, target), {
							mapError: mapEntryWriteError,
						});
						results.set(index, { type: target.type, id: target.id, ok: true });
						for (const media of removal.files) files.push({ index, media });
						entryIds.push(...removal.entryIds);
						for (const id of removal.gone) gone.add(id);
						progressed = true;
					} catch (error) {
						results.set(index, resultOf(target, error));
						if (error instanceof CmsError && error.code === "in_use") blocked.push(index);
					}
				}
				if (!progressed) break;
				pending = blocked;
			}
			return {
				results: params.targets.map((_, index) => results.get(index) as TrashDeleteResult),
				files,
				entryIds,
			};
		},
	};
}
