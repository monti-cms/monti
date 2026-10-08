import type { GitSyncMode } from "./options.js";
import { type SettingsView } from "./settings.js";
import type { PullSummary, TargetStatus } from "./state.js";
import type { SyncContext } from "./sync.js";
/** What the admin screen shows about one target. */
export interface TargetView {
    readonly id: string;
    readonly repo: string;
    readonly branch: string;
    readonly folder: string;
    readonly format: string;
    readonly path: string;
    readonly mode: GitSyncMode;
    readonly prBranch: string;
    readonly collections: readonly string[];
    /** Entries synced (with a file). */
    readonly synced: number;
    /** Publishes waiting for their commit. */
    readonly queued: number;
    readonly conflicts: number;
    readonly lastPull?: PullSummary;
    readonly lastFlush?: TargetStatus["lastFlush"];
}
export interface StatusView {
    readonly settings: SettingsView;
    readonly targets: readonly TargetView[];
}
export declare function statusView(ctx: SyncContext): Promise<StatusView>;
