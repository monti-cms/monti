import type { ConflictRecord } from "./state.js";
import { type SyncContext } from "./sync.js";
/**
 * Conflicts: an entry that changed on both sides (or was removed on one and edited on the other) since the last sync waits here until a person picks a side.
 * Nothing is merged. The admin shows the two texts, both written by the target's format: the server's from the entry as it is now, the git one as it was when
 * the conflict was found.
 */
/** A conflict with the two texts to compare. */
export interface ConflictView {
    readonly id: string;
    readonly target: string;
    readonly repo: string;
    readonly entryId: string;
    readonly collection: string;
    readonly locale: string;
    readonly path: string;
    readonly kind: ConflictRecord["kind"];
    readonly reason: ConflictRecord["reason"];
    readonly detectedAt: string;
    /** The title (or slug) of the entry, for the list. */
    readonly label: string;
    /** What the server has now, in the target's format (front matter included). `null` when the entry is not published (the server's version is "removed"). */
    readonly serverText: string | null;
    /** What git has (as of the conflict). */
    readonly gitText: string;
    /** The blob sha of `gitText`. Sent back with the decision, so a file that changed again since is not decided blind. */
    readonly gitSha: string;
}
/** The open conflicts, each with the server's text as it is now. */
export declare function listConflicts(ctx: SyncContext): Promise<ConflictView[]>;
export type Resolution = "git" | "server";
/**
 * Settles a conflict.
 *
 * - `"git"` ("Use git version"): the git text is written to the entry with the same pipeline as an edit and published, replacing what the server has (a draft with
 *   unpublished changes included). A trashed or archived entry comes back; a deleted one is created again.
 * - `"server"` ("Use server version"): the entry as the server has it is pushed to the repo, replacing the file in git (or deleting it, when the entry is not published
 *   any more), in a commit or a pull request as the target's mode says.
 *
 * `gitSha` is the blob the person looked at: if the file changed again since, the decision is refused, so a newer edit is never decided blind.
 */
export declare function resolveConflict(ctx: SyncContext, params: {
    readonly target: string;
    readonly entryId: string;
    readonly resolution: Resolution;
    readonly gitSha?: string;
}): Promise<{
    readonly resolution: Resolution;
    readonly pullRequestUrl?: string;
}>;
