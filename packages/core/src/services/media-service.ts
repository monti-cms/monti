import type { ContentStore } from "../core/store";
import type { MediaStore } from "../media/store";

/** Uploads that never completed are cleaned up after this long. */
export const STALE_UPLOAD_AFTER_MS = 24 * 60 * 60 * 1000;

export interface MediaServiceDeps {
	readonly store: () => Pick<ContentStore, "beginMediaDelete" | "finalizeMediaDelete" | "listStaleUploads">;
	readonly mediaStore: () => Pick<MediaStore, "deleteFile">;
	/** For tests: the clock. */
	readonly now?: () => Date;
}

export interface MediaService {
	/**
	 * Deletes a file that nothing uses. Marks the row `deleting` (which fails with `in_use` when something refers to it), deletes its files, and removes the row.
	 * If deleting a file fails, the `deleting` row stays and the call can be repeated.
	 */
	delete(id: string): Promise<void>;
	/**
	 * Removes incomplete or failed uploads older than 24 hours. An upload whose file deletion fails is kept and retried at the next cleanup; the ids that
	 * failed are in `failed`.
	 */
	cleanup(): Promise<{ readonly removed: number; readonly failed: readonly string[] }>;
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

	return {
		delete: async (id) => {
			const media = await deps.store().beginMediaDelete(id);
			await purge(id, [media.storageKey, media.stagingKey, media.original?.storageKey, media.original?.stagingKey]);
		},
		cleanup: async () => {
			const before = new Date((deps.now?.() ?? new Date()).getTime() - STALE_UPLOAD_AFTER_MS);
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
		},
	};
}
