import type { UnreadableBody } from "../server/define.js";
/**
 * What `monti migrate` says about bodies that could not be read as documents and were kept exactly as they were. The steps report each body as it is found
 * (`UnreadableBody`); this turns the list into a few plain lines. The per-body lines stay available (`monti migrate --verbose`).
 */
/** The same body reported by several steps, as one: the facts any of them knew. */
export declare function mergeUnreadable(found: ReadonlyMap<string, UnreadableBody>, next: UnreadableBody): UnreadableBody;
/** One body per line, for `--verbose`. */
export declare const unreadableLine: (body: UnreadableBody) => string;
/**
 * The summary lines. `again`: the bodies were read a second time (`--reconvert-bodies`) and these are the ones that still cannot be, so the advice to turn on a
 * syntax and read them again is left out.
 */
export declare function describeUnreadable(found: readonly UnreadableBody[], options?: {
    readonly again?: boolean;
}): string[];
