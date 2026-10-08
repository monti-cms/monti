import type { ResolvedTarget } from "./options.js";
import type { PullSummary } from "./state.js";
import { type SyncContext } from "./sync.js";
export { type Applied, applyFile, describeError, type FileToApply, recordOf } from "./apply.js";
/**
 * Pulls one target: reads the files of its folder at the head of the branch and applies what changed. A file that cannot be applied is reported in `errors`
 * and does not stop the others. Returns what happened (also kept for the admin screen).
 */
export declare function pullTarget(ctx: SyncContext, target: ResolvedTarget): Promise<PullSummary>;
