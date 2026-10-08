import type { PluginStorage, StorageItem } from "@monti-cms/core/plugin/server";
/**
 * What the plugin remembers, in its own plugin storage (`cms.storage("git-sync")`): per entry the file it was last synced to, the queue of publishes waiting for
 * their commit, the conflicts waiting for a decision, and a lock per target. Nothing here is the entry itself: the CMS database and the repo are the two sides.
 */
/** The collections of the plugin's storage. */
export declare const COLLECTIONS: {
    readonly settings: "settings";
    readonly records: "records";
    readonly queue: "queue";
    readonly conflicts: "conflicts";
    readonly status: "status";
    readonly locks: "locks";
    readonly applying: "applying";
};
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
"changed"
/** The entry was unpublished or deleted on the server and the file was edited in git. */
 | "removed";
export type ConflictReason = "both-changed" | "unpublished-changes" | "unsynced" | "git-edit-blocks-removal" | "path-taken";
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
    readonly skipped: readonly {
        readonly path: string;
        readonly reason: string;
    }[];
    readonly errors: readonly {
        readonly path: string;
        readonly message: string;
    }[];
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
export declare const entryKey: (target: string, entryId: string) => string;
/** The key of a conflict: one per entry per target. */
export declare const conflictKey: typeof entryKey;
/** Typed access to the plugin's storage. */
export declare function createState(storage: PluginStorage): {
    settings: {
        get: () => Promise<StorageItem<StoredSettings> | null>;
        save: (value: StoredSettings, expectedVersion: number) => Promise<StorageItem<StoredSettings>>;
    };
    records: {
        get: (target: string, entryId: string) => Promise<SyncRecord | null>;
        /** Every record of a target, by entry id. */
        list: (target: string) => Promise<Map<string, SyncRecord>>;
        put: (record: SyncRecord) => Promise<StorageItem<SyncRecord>>;
        remove: (target: string, entryId: string) => Promise<void>;
    };
    queue: {
        list: (target?: string) => Promise<{
            item: QueueItem;
            version: number;
        }[]>;
        put: (item: QueueItem) => Promise<StorageItem<QueueItem>>;
        get: (target: string, entryId: string) => Promise<StorageItem<QueueItem> | null>;
        /** Removes an item only if it was not queued again since it was read (its version is the one given). */
        removeIfUnchanged: (target: string, entryId: string, version: number) => Promise<void>;
        remove: (target: string, entryId: string) => Promise<void>;
    };
    conflicts: {
        list: (target?: string) => Promise<ConflictRecord[]>;
        get: (target: string, entryId: string) => Promise<ConflictRecord | null>;
        put: (conflict: ConflictRecord) => Promise<StorageItem<ConflictRecord>>;
        remove: (target: string, entryId: string) => Promise<void>;
    };
    status: {
        get: (target: string) => Promise<TargetStatus>;
        /** Merges values into the target's status. */
        patch: (target: string, values: Partial<TargetStatus>) => Promise<void>;
    };
    locks: {
        get: (target: string) => Promise<StorageItem<LockValue> | null>;
        /** Takes the lock when there is none, or when it has expired. `false` when someone holds it. */
        tryAcquire: (target: string, holder: string, ttlMs: number, now: number) => Promise<boolean>;
        release: (target: string, holder: string) => Promise<void>;
    };
    /** Marks a path as being written by an import, so the publish that import causes is not pushed back. */
    applying: {
        mark: (target: string, path: string, now: number) => Promise<StorageItem<ApplyingValue>>;
        isMarked: (target: string, path: string, now: number, windowMs: number) => Promise<boolean>;
        clear: (target: string, path: string) => Promise<void>;
    };
};
export type SyncState = ReturnType<typeof createState>;
export {};
