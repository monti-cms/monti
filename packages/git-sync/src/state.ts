import type { PluginCollection, PluginStorage, StorageItem } from "@monti-cms/core/plugin/server";

/**
 * What the plugin remembers, in its own plugin storage (`cms.storage("git-sync")`): per entry the file it was last synced to, the queue of publishes waiting for
 * their commit, the conflicts waiting for a decision, and a lock per target. Nothing here is the entry itself: the CMS database and the repo are the two sides.
 */

/** The collections of the plugin's storage. */
export const COLLECTIONS = {
	settings: "settings",
	records: "records",
	queue: "queue",
	conflicts: "conflicts",
	status: "status",
	locks: "locks",
	applying: "applying",
} as const;

/** The saved settings (one item, `default`). The values are encrypted with the plugin's key (`cms.secrets("git-sync")`). */
export interface StoredSettings {
	/** The GitHub token. */
	readonly token: string | null;
	/** The secret the push webhook is signed with. */
	readonly webhookSecret: string | null;
}

/**
 * What was last synced for one entry of one target. `blobSha` is the git blob git-sync last wrote (or read) for the entry, `contentHash` the content hash of the published
 * entry it came from. A side changed since then exactly when its current value differs: that is how a hash mismatch is told apart from "nothing to do" and from a conflict.
 */
export interface SyncRecord {
	readonly target: string;
	readonly entryId: string;
	readonly collection: string;
	readonly locale: string;
	readonly slug: string;
	/** Repo-relative path of the file. */
	readonly path: string;
	/** The blob git-sync last pushed or imported. `null`: git-sync removed the file (a pull request that has not merged yet). */
	readonly blobSha: string | null;
	/**
	 * The blob known to be on the target's branch. It is `blobSha` after a commit; in `"pr"` mode it is the blob from before the pull request until it merges, so a
	 * file that still has the old text is not mistaken for an edit in git.
	 */
	readonly baseSha: string | null;
	/** Content hash of the published entry as of the last sync. */
	readonly contentHash: string | null;
	readonly syncedAt: string;
}

/** A publish (or removal) waiting for its commit. One per entry per target: a newer event of the same entry replaces it. */
export interface QueueItem {
	readonly target: string;
	readonly entryId: string;
	/** When it was queued, in epoch milliseconds. */
	readonly queuedAt: number;
}

export type ConflictKind =
	/** Both sides changed: the file in git and the published entry. */
	| "changed"
	/** The entry was unpublished or deleted on the server and the file was edited in git. */
	| "removed";

export type ConflictReason =
	| "both-changed"
	| "unpublished-changes"
	| "unsynced"
	| "git-edit-blocks-removal"
	| "path-taken";

/** A decision waiting for a person: nothing is merged until it is made. */
export interface ConflictRecord {
	readonly id: string;
	readonly target: string;
	readonly entryId: string;
	readonly collection: string;
	readonly locale: string;
	/** Repo-relative path of the file in git. */
	readonly path: string;
	readonly kind: ConflictKind;
	readonly reason: ConflictReason;
	/** The blob of the git version and its text, as they were when the conflict was found (the git side of the diff). */
	readonly gitSha: string;
	readonly gitText: string;
	readonly detectedAt: string;
}

/** What a pull did, kept to show on the admin screen. */
export interface PullSummary {
	readonly at: string;
	readonly head: string;
	readonly applied: number;
	readonly created: number;
	readonly unchanged: number;
	readonly conflicts: number;
	readonly skipped: readonly { readonly path: string; readonly reason: string }[];
	readonly errors: readonly { readonly path: string; readonly message: string }[];
}

export interface TargetStatus {
	readonly lastPull?: PullSummary;
	/** When the last commit (or pull request update) went out, in epoch milliseconds. It starts the batching window. */
	readonly lastFlushAt?: number;
	readonly lastFlush?: {
		readonly at: string;
		readonly files: number;
		readonly commitSha: string;
		readonly branch: string;
		readonly pullRequestUrl?: string;
		readonly note?: string;
	};
}

interface LockValue {
	readonly holder: string;
	readonly expiresAt: number;
}

interface ApplyingValue {
	readonly at: number;
}

const isConflict = (error: unknown): boolean => (error as { code?: unknown } | null)?.code === "conflict";
const isNotFound = (error: unknown): boolean => (error as { code?: unknown } | null)?.code === "not_found";

/** Writes an item whatever its stored version is (last write wins). Retries when another writer got in between. */
async function upsert<T>(collection: PluginCollection<T>, key: string, value: T): Promise<StorageItem<T>> {
	for (let attempt = 0; ; attempt += 1) {
		const current = await collection.get(key);
		try {
			return await collection.set(key, value, { expectedVersion: current?.version ?? 0 });
		} catch (error) {
			if (!isConflict(error) || attempt >= 4) throw error;
		}
	}
}

/** Deletes an item if it is there. */
async function removeItem<T>(collection: PluginCollection<T>, key: string): Promise<void> {
	const current = await collection.get(key);
	if (!current) return;
	try {
		await collection.delete(key, { expectedVersion: current.version });
	} catch (error) {
		if (!isNotFound(error) && !isConflict(error)) throw error;
	}
}

export const entryKey = (target: string, entryId: string) => `${target}:${entryId}`;
const prefixOf = (target: string) => `${target}:`;

/** Typed access to the plugin's storage. */
export function createState(storage: PluginStorage) {
	const settings = storage.collection<StoredSettings>(COLLECTIONS.settings);
	const records = storage.collection<SyncRecord>(COLLECTIONS.records);
	const queue = storage.collection<QueueItem>(COLLECTIONS.queue);
	const conflicts = storage.collection<ConflictRecord>(COLLECTIONS.conflicts);
	const status = storage.collection<TargetStatus>(COLLECTIONS.status);
	const locks = storage.collection<LockValue>(COLLECTIONS.locks);
	const applying = storage.collection<ApplyingValue>(COLLECTIONS.applying);

	return {
		settings: {
			get: () => settings.get("default"),
			save: (value: StoredSettings, expectedVersion: number) => settings.set("default", value, { expectedVersion }),
		},
		records: {
			get: async (target: string, entryId: string) => (await records.get(entryKey(target, entryId)))?.value ?? null,
			/** Every record of a target, by entry id. */
			list: async (target: string) =>
				new Map(
					(await records.list({ prefix: prefixOf(target) })).map((item) => [item.value.entryId, item.value] as const),
				),
			put: (record: SyncRecord) => upsert(records, entryKey(record.target, record.entryId), record),
			remove: (target: string, entryId: string) => removeItem(records, entryKey(target, entryId)),
		},
		queue: {
			list: async (target?: string) =>
				(await queue.list(target ? { prefix: prefixOf(target) } : undefined)).map((item) => ({
					item: item.value,
					version: item.version,
				})),
			put: (item: QueueItem) => upsert(queue, entryKey(item.target, item.entryId), item),
			get: async (target: string, entryId: string) => queue.get(entryKey(target, entryId)),
			/** Removes an item only if it was not queued again since it was read (its version is the one given). */
			removeIfUnchanged: async (target: string, entryId: string, version: number) => {
				try {
					await queue.delete(entryKey(target, entryId), { expectedVersion: version });
				} catch (error) {
					if (!isNotFound(error) && !isConflict(error)) throw error;
				}
			},
			remove: (target: string, entryId: string) => removeItem(queue, entryKey(target, entryId)),
		},
		conflicts: {
			list: async (target?: string) =>
				(await conflicts.list(target ? { prefix: prefixOf(target) } : undefined)).map((item) => item.value),
			get: async (target: string, entryId: string) => (await conflicts.get(entryKey(target, entryId)))?.value ?? null,
			put: (conflict: ConflictRecord) => upsert(conflicts, conflict.id, conflict),
			remove: (target: string, entryId: string) => removeItem(conflicts, entryKey(target, entryId)),
		},
		status: {
			get: async (target: string): Promise<TargetStatus> => (await status.get(target))?.value ?? {},
			/** Merges values into the target's status. */
			patch: async (target: string, values: Partial<TargetStatus>) => {
				await upsert(status, target, { ...((await status.get(target))?.value ?? {}), ...values });
			},
		},
		locks: {
			get: async (target: string) => (await locks.get(target)) ?? null,
			/** Takes the lock when there is none, or when it has expired. `false` when someone holds it. */
			tryAcquire: async (target: string, holder: string, ttlMs: number, now: number): Promise<boolean> => {
				const current = await locks.get(target);
				if (current && current.value.expiresAt > now) return false;
				try {
					await locks.set(target, { holder, expiresAt: now + ttlMs }, { expectedVersion: current?.version ?? 0 });
					return true;
				} catch (error) {
					if (isConflict(error)) return false;
					throw error;
				}
			},
			release: async (target: string, holder: string) => {
				const current = await locks.get(target);
				if (current?.value.holder !== holder) return;
				try {
					await locks.delete(target, { expectedVersion: current.version });
				} catch (error) {
					if (!isNotFound(error) && !isConflict(error)) throw error;
				}
			},
		},
		/** Marks a path as being written by an import, so the publish that import causes is not pushed back. */
		applying: {
			mark: (target: string, path: string, now: number) => upsert(applying, entryKey(target, path), { at: now }),
			isMarked: async (target: string, path: string, now: number, windowMs: number) => {
				const item = await applying.get(entryKey(target, path));
				return item !== null && now - item.value.at < windowMs;
			},
			clear: (target: string, path: string) => removeItem(applying, entryKey(target, path)),
		},
	};
}

export type SyncState = ReturnType<typeof createState>;
