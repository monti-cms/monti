import { isTrashExpired } from "../core/domain/trash";
import { prepareSnapshot } from "../core/snapshot";
import { CmsError, type ContentStore } from "../core/store";
import type { UnlinkBody, UnlinkedBody } from "../core/store/trash";
import type {
	FolderContents,
	FolderTrashResult,
	MediaTrashResult,
	TrashDeleteResult,
	TrashEmptyResult,
	TrashListParams,
	TrashListResult,
	TrashRestoreResult,
	TrashTarget,
} from "../core/trash";
import type { PreparedSnapshot } from "../core/types";
import { ServiceError } from "../core/types";
import type { MediaStore } from "../media/store";
import type { Site } from "../site";
import type { createContentService } from "./content-service";
import type { MediaService } from "./media-service";

/** The expired units are purged when the trash is looked at, at most this often (per process). */
export const PURGE_EVERY_MS = 24 * 60 * 60 * 1000;

type ContentWrites = ReturnType<typeof createContentService>;

type TrashStoreUse = Pick<
	ContentStore,
	| "listTrash"
	| "listTrashUnits"
	| "trashFolder"
	| "folderRestoreEntries"
	| "restoreFolder"
	| "trashMedia"
	| "restoreMedia"
	| "deleteTrashed"
	| "unlinkReferences"
	| "getFolderContents"
	| "getEntry"
>;

export interface TrashServiceDeps {
	readonly site: Site;
	readonly store: () => TrashStoreUse;
	/** The addresses of the media files shown in the trash. Absent without a media store: the files then have no preview. */
	readonly mediaStore?: () => Pick<MediaStore, "getPublicUrl">;
	readonly media: () => Pick<MediaService, "remove">;
	readonly content: () => Pick<ContentWrites, "restore" | "prepareRestore">;
	/** For tests: the clock. */
	readonly now?: () => Date;
}

/** Who is unlinked: the entries named, or every entry of a collection. */
export type UnlinkRequest = { readonly targetIds?: readonly string[]; readonly collection?: string };

export interface TrashService {
	/** What a live folder holds, before it is discarded. */
	folderContents(id: string): Promise<FolderContents>;
	/** Discards a folder with what is in it (see `TrashStore.trashFolder`). */
	trashFolder(params: { id: string; expectedVersion?: number }): Promise<FolderTrashResult>;
	/** Discards media files; those in use stay. */
	trashMedia(ids: readonly string[]): Promise<MediaTrashResult>;
	/** The trash. Purges the expired units first when that was not done in the last day. */
	list(params: TrashListParams): Promise<TrashListResult>;
	/** Puts units back. One result per unit, in order; a failing unit does not stop the others. */
	restore(items: readonly TrashTarget[]): Promise<readonly TrashRestoreResult[]>;
	/** Deletes units for good, a result per unit in the order of the request. A unit held back by another unit of the same request is tried again after it. */
	delete(items: readonly TrashTarget[]): Promise<readonly TrashDeleteResult[]>;
	/** Deletes everything at the top of the trash. What entries still point at stays. */
	empty(): Promise<TrashEmptyResult>;
	/** Deletes the units discarded more than the keeping time ago. What entries still point at stays. */
	purge(): Promise<TrashEmptyResult>;
	/** Takes entries out of the relation fields of the others, so they can be deleted. The number of entries changed. */
	unlink(request: UnlinkRequest): Promise<{ readonly entries: number }>;
}

const codeOf = (error: unknown): string =>
	error instanceof CmsError || error instanceof ServiceError ? error.code : "internal";

export function createTrashService(deps: TrashServiceDeps): TrashService {
	const { site } = deps;
	const now = () => deps.now?.() ?? new Date();
	let lastPurge: number | undefined;

	/** Deletes the units in the database, then the stored files of the media files that went. */
	const deleteUnits = async (targets: readonly TrashTarget[]): Promise<TrashDeleteResult[]> => {
		if (targets.length === 0) return [];
		const outcome = await deps.store().deleteTrashed({ targets });
		const results = [...outcome.results];
		for (const { index, media } of outcome.files) {
			try {
				await deps.media().remove(media);
			} catch {
				// A file that could not be deleted stays in the trash, and the unit that is a file reports it. A folder is gone either way.
				const target = targets[index] as TrashTarget;
				if (target.type === "media")
					results[index] = { type: target.type, id: target.id, ok: false, error: "storage_failed" };
			}
		}
		return results;
	};

	const emptied = async (
		units: readonly { type: TrashTarget["type"]; id: string; title: string | null; expectedVersion?: number }[],
	) => {
		const results = await deleteUnits(units.map(({ type, id, expectedVersion }) => ({ type, id, expectedVersion })));
		const kept: TrashEmptyResult["kept"][number][] = [];
		results.forEach((result, index) => {
			if (result.ok) return;
			const unit = units[index];
			if (unit) kept.push({ type: unit.type, id: unit.id, title: unit.title, usages: result.usages ?? [] });
		});
		return { deleted: results.length - kept.length, kept } satisfies TrashEmptyResult;
	};

	const purge = async (): Promise<TrashEmptyResult> => {
		lastPurge = now().getTime();
		const units = (await deps.store().listTrashUnits()).filter((unit) => isTrashExpired(unit.deletedAt, now()));
		return emptied(units);
	};

	const restoreOne = async (item: TrashTarget): Promise<TrashRestoreResult> => {
		const { type, id } = item;
		try {
			if (type === "media") {
				const { media, recreated } = await deps.store().restoreMedia({ id });
				return { type, id, ok: true, folderId: media.folderId, recreated };
			}
			if (type === "folder") {
				const entries = await deps.store().folderRestoreEntries({ id });
				const snapshots = new Map<string, PreparedSnapshot>();
				for (const entry of entries) {
					const { snapshot } = await deps.content().prepareRestore(entry.id);
					if (snapshot) snapshots.set(entry.id, snapshot);
				}
				const restored = await deps.store().restoreFolder({ id, expectedVersion: item.expectedVersion, snapshots });
				return { type, id, ok: true, folderId: restored.folderId, recreated: restored.recreated };
			}
			let recreated = false;
			const current = item.expectedVersion === undefined ? await deps.store().getEntry(id) : undefined;
			const { entry } = await deps.content().restore({
				id,
				expectedVersion: item.expectedVersion ?? (current?.version as number),
				onPlaced: (placed) => {
					recreated = placed.recreated;
				},
			});
			return { type, id, ok: true, folderId: entry.folderId, recreated };
		} catch (error) {
			const code = codeOf(error);
			if (code === "source_trashed") {
				const entry = await deps
					.store()
					.getEntry(id)
					.catch(() => undefined);
				return { type, id, ok: false, error: code, ...(entry ? { sourceId: entry.translationGroupId } : {}) };
			}
			return { type, id, ok: false, error: code };
		}
	};

	const withoutTargets = (body: UnlinkBody, targets: ReadonlySet<string>) => {
		const metadata: Record<string, unknown> = { ...body.metadata };
		let changed = false;
		for (const { name, field } of site.storedFields(body.collection)) {
			if (field.kind !== "relation") continue;
			const value = metadata[name];
			if (typeof value === "string" && targets.has(value)) {
				delete metadata[name];
				changed = true;
			} else if (Array.isArray(value)) {
				const rest = value.filter((id) => !(typeof id === "string" && targets.has(id)));
				if (rest.length === value.length) continue;
				changed = true;
				if (rest.length > 0) metadata[name] = rest;
				else delete metadata[name];
			}
		}
		return changed ? metadata : null;
	};

	/** The body as the write rules prepare it once the targets are out of its relation fields. */
	const rewrite = async (body: UnlinkBody, targets: ReadonlySet<string>): Promise<UnlinkedBody | null> => {
		const metadata = withoutTargets(body, targets);
		if (!metadata) return null;
		const snapshot = await prepareSnapshot(
			site,
			{ collection: body.collection, slug: null, metadata, doc: body.doc } as never,
			{ previousMetadata: body.metadata, previousDoc: body.doc },
		);
		return {
			metadata: snapshot.metadata as never,
			doc: snapshot.doc,
			contentHash: snapshot.contentHash,
			references: snapshot.references.flatMap((ref) => {
				const occurrences = ref.occurrences.filter((occurrence) => occurrence.type === "metadata");
				return occurrences.length === 0 ? [] : [{ kind: ref.kind, targetId: ref.targetId, occurrences }];
			}),
		};
	};

	return {
		folderContents: (id) => deps.store().getFolderContents({ id }),
		trashFolder: async (params) => {
			const { entryIds: _entryIds, ...result } = await deps.store().trashFolder(params);
			return result;
		},
		trashMedia: (ids) => deps.store().trashMedia({ ids }),
		list: async (params) => {
			if (lastPurge === undefined || now().getTime() - lastPurge >= PURGE_EVERY_MS) {
				try {
					await purge();
				} catch (error) {
					// The list must still open; the purge is tried again at the next look.
					console.error("[cms] the trash purge failed", error);
				}
			}
			const { mediaKeys, ...result } = await deps.store().listTrash(params);
			const mediaStore = deps.mediaStore?.();
			return {
				...result,
				items: result.items.map((item) =>
					item.type === "media" && mediaKeys[item.id] && mediaStore
						? { ...item, url: mediaStore.getPublicUrl(mediaKeys[item.id] as string) }
						: item,
				),
			};
		},
		restore: async (items) => {
			const results: TrashRestoreResult[] = [];
			for (const item of items) results.push(await restoreOne(item));
			return results;
		},
		delete: deleteUnits,
		empty: async () => emptied(await deps.store().listTrashUnits()),
		purge,
		unlink: async (request) => {
			const { entries } = await deps.store().unlinkReferences({ ...request, rewrite });
			return { entries };
		},
	};
}
