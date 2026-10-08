import type { CmsFormat } from "@monti-cms/core/format";
import { type Cms } from "@monti-cms/core/plugin/server";
import type { GitHubClient } from "./github/client.js";
import { type GitSyncOptions, type ResolvedTarget } from "./options.js";
import { type PathPattern } from "./path-pattern.js";
import { type SyncState } from "./state.js";
/** An error a person can fix (a token that is not saved, a format that is not installed). It is thrown like any other, so the event outbox retries and then keeps it. */
export declare class GitSyncError extends Error {
    constructor(message: string);
}
/**
 * No usable GitHub token is saved. That is a setup state, not a failure: the events of synced entries are deferred (not failed) until a token is saved, and the entries
 * wait in the queue.
 */
export declare class GitSyncNotConfigured extends GitSyncError {
    constructor(message: string);
}
/** How long a delivery waits when no token is saved. Saving a token resumes the deliveries at once. */
export declare const NOT_CONFIGURED_RETRY_MS: number;
/** An import marks the files it writes for this long, so the publishes it causes are not pushed back. */
export declare const APPLYING_WINDOW_MS: number;
/** What a test can replace. */
export interface SyncDeps {
    readonly now?: () => number;
    readonly sleep?: (ms: number) => Promise<void>;
}
/** Everything the sync code needs for one CMS instance. */
export interface SyncContext {
    readonly cms: Cms;
    readonly options: GitSyncOptions;
    readonly targets: readonly ResolvedTarget[];
    readonly state: SyncState;
    readonly debounceMs: number;
    /** Targets this process is writing files into right now (an import in progress). A publish it causes is queued but not committed until the import ends. */
    readonly importing: Set<string>;
    now(): number;
    sleep(ms: number): Promise<void>;
    /** The target with this id. Throws when there is none. */
    target(id: string): ResolvedTarget;
    /** The GitHub client of a target, made with the saved token. Throws when no token is saved. */
    client(target: ResolvedTarget): Promise<GitHubClient>;
    /** The format of a target and its path pattern. Throws when the format is not installed or cannot import. */
    format(target: ResolvedTarget): Promise<{
        readonly format: CmsFormat;
        readonly pattern: PathPattern;
    }>;
    /** Runs `fn` while holding the target's lock: one flush or pull at a time per target, across processes. */
    withLock<T>(target: ResolvedTarget, fn: () => Promise<T>, options?: {
        readonly waitMs?: number;
    }): Promise<T>;
}
/** The options of the plugin as the site config gives them. */
export declare function readOptions(cms: Cms): GitSyncOptions;
export declare function createSyncContext(cms: Cms, deps?: SyncDeps): SyncContext;
/** The sync context of an instance, made on first use. Each instance has its own. */
export declare function syncContextFor(cms: Cms): SyncContext;
