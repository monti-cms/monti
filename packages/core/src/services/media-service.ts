import type { ContentStore } from "../core/store";
import type { MediaAssetRecord, ReleasedMediaFiles } from "../core/store/types";
import type { MediaStore } from "../media/store";

/** Uploads that never completed are cleaned up after this long. */
export const STALE_UPLOAD_AFTER_MS = 24 * 60 * 60 * 1000;

/** The cleanup runs when the library is read, at most this often (per process). */
export const CLEANUP_EVERY_MS = 24 * 60 * 60 * 1000;

export interface MediaServiceDeps {
	readonly store: () => Pick<ContentStore, "finalizeMediaDelete" | "listStaleUploads">;
	readonly mediaStore: () => Pick<MediaStore, "deleteFile">;
	/** For tests: the clock. */
	readonly now?: () => Date;
}

export interface MediaService {
	/**
	 * Takes a media file away for good: its stored files (the file, the original, what is still staged), then its row. If deleting a stored file fails the row
	 * stays, so the call can be repeated. Whether the file may go (it was in the trash, nothing points at it) is decided before, by the trash.
	 */
	remove(media: Pick<MediaAssetRecord, "id" | "storageKey" | "stagingKey" | "original">): Promise<void>;
	/**
	 * Deletes the stored files a replaced media file gave up, after the replace was committed. Best effort: a file that cannot be deleted stays behind as a
	 * stray file, and the replace stays done.
	 */
	release(files: ReleasedMediaFiles): Promise<void>;
	/**
	 * Removes incomplete or failed uploads older than 24 hours. An upload whose file deletion fails is kept and retried at the next cleanup; the ids that
	 * failed are in `failed`.
	 */
	cleanup(): Promise<{ readonly removed: number; readonly failed: readonly string[] }>;
	/**
	 * Runs {@link MediaService.cleanup} when it has not run for a day in this process; the library calls it each time it is read. A failure is logged and
	 * swallowed, so the library still opens, and the cleanup is tried again at the next read.
	 */
	cleanupIfDue(): Promise<void>;
}

export function createMediaService(deps: MediaServiceDeps): MediaService {
	/** The one place that takes a media row away: its files first, then the row, so a failure leaves a row that can be tried again. */
	const purge = async (id: string, keys: readonly (string | null | undefined)[]) => {
		const mediaStore = deps.mediaStore();
		for (const key of keys) {
			if (key) await mediaStore.deleteFile({ key });
		}
		await deps.store().finalizeMediaDelete(id);
	};

	let lastCleanup: number | undefined;
	const now = () => deps.now?.() ?? new Date();

	const cleanup = async () => {
		const before = new Date(now().getTime() - STALE_UPLOAD_AFTER_MS);
		const stale = await deps.store().listStaleUploads({ before });
		let removed = 0;
		const failed: string[] = [];
		for (const media of stale) {
			try {
				// An upload that never completed has no final file, only what was staged.
				await purge(media.id, [media.stagingKey, media.original?.stagingKey]);
				removed += 1;
			} catch {
				failed.push(media.id);
			}
		}
		return { removed, failed };
	};

	return {
		cleanupIfDue: async () => {
			if (lastCleanup !== undefined && now().getTime() - lastCleanup < CLEANUP_EVERY_MS) return;
			try {
				await cleanup();
				lastCleanup = now().getTime();
			} catch (error) {
				console.error("[cms] the cleanup of interrupted uploads failed", error);
			}
		},
		release: async (files) => {
			const mediaStore = deps.mediaStore();
			for (const key of [files.storageKey, files.originalStorageKey]) {
				if (!key) continue;
				try {
					await mediaStore.deleteFile({ key });
				} catch {
					// The replace is committed; a stray file does not undo it.
				}
			}
		},
		remove: (media) =>
			purge(media.id, [media.storageKey, media.stagingKey, media.original?.storageKey, media.original?.stagingKey]),
		cleanup,
	};
}
