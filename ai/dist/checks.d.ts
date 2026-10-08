import type { Site } from "@monti-cms/core/client";
import type { AiCandidate, AiCheck } from "./definition.js";
/**
 * Fixed result checks (pure functions). Applies the enabled checks from the action's check list in order, and discards candidates that fail.
 * Does not modify or truncate candidates. Code checks (`defineValidator`) are called by the runner after these checks.
 */
export interface CheckEnv {
    /** Current value. Candidates equal to it are dropped. */
    current?: string | readonly string[];
    /** Selectable values -> display names (`exists` check, shows candidate names). */
    options?: ReadonlyMap<string, string>;
}
export declare function checkCandidates(checks: readonly AiCheck[], raw: readonly string[], env: CheckEnv): AiCandidate[];
/** Check for long-text results. Returns the reason if it fails. */
export declare function checkText(site: Pick<Site, "createTranslator">, checks: readonly AiCheck[], text: string): string | null;
