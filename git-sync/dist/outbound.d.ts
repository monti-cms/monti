import { type ContentEvent } from "@monti-cms/core/plugin/server";
import type { ResolvedTarget } from "./options.js";
import type { SyncRecord } from "./state.js";
import { type SyncContext } from "./sync.js";
/** What a flush did. */
export interface FlushResult {
    readonly target: string;
    /** Files written (new, changed or renamed to). */
    readonly written: number;
    /** Files deleted. */
    readonly removed: number;
    readonly conflicts: number;
    readonly commitSha?: string;
    readonly branch?: string;
    readonly pullRequestUrl?: string;
    /** Entries that failed; they stay queued. */
    readonly failed: readonly {
        readonly entryId: string;
        readonly message: string;
    }[];
}
export declare const errorText: (error: unknown) => string;
/** Whether a blob in git is the one git-sync knows about for an entry (it has not been edited in git since). */
export declare const isKnownBlob: (record: SyncRecord, sha: string | null) => boolean;
/**
 * Commits everything in a target's queue. Entries that cannot be planned (an export that fails, a conflict) do not hold the others back; the failed ones stay
 * queued and make the call throw once the rest is committed, so the outbox retries. `entries` adds entries to push whatever git says about them.
 */
export declare function flushTarget(ctx: SyncContext, target: ResolvedTarget, options?: {
    readonly force?: readonly string[];
}): Promise<FlushResult>;
/** Puts an entry in the queue of a target. */
export declare function enqueue(ctx: SyncContext, target: ResolvedTarget, entryId: string): Promise<number>;
/** What handling one event did for each target: failures to throw, and the moments to be called again at. */
export interface EventOutcome {
    readonly failures: unknown[];
    readonly deferred: Date[];
}
/**
 * The part of the `afterCommit` subscriber for published files. For each target that syncs the entry's collection it queues the entry and commits the queue.
 * The event only says that something happened; what goes to the repo is the entry as it is now (its published version, or none).
 */
export declare function onPublishedEvent(ctx: SyncContext, event: ContentEvent): Promise<EventOutcome>;
/**
 * Called after a token was saved: commits what waited in the queues and delivers the deferred events (they find their entries committed). Failures are not
 * the save's business, so none is thrown: they stay queued and are retried like any other.
 */
export declare function resumeAfterToken(ctx: SyncContext): Promise<void>;
/** Queues every published entry of a target (the first sync) and commits them in one go. Entries already in git as they are cost nothing. */
export declare function pushAll(ctx: SyncContext, target: ResolvedTarget): Promise<FlushResult & {
    readonly queued: number;
}>;
/** Pushes the server's version of the given entries, whatever git says (what "Use server version" does). */
export declare function pushEntries(ctx: SyncContext, target: ResolvedTarget, entryIds: readonly string[]): Promise<FlushResult>;
