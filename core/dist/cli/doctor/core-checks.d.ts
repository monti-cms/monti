import type { Cms } from "../../cms/index.js";
import { type CheckOutcome } from "./outcome.js";
/** Everything the core checks look at, gathered once before they run. */
export interface DoctorState {
    readonly cwd: string;
    readonly env: Readonly<Record<string, string | undefined>>;
    /** Env files that were read (relative to `cwd`). */
    readonly envFiles: readonly string[];
    /** Set when an env file chosen with `--env-file` does not exist. */
    readonly envError?: Error;
    /** The variables of each env file that exists, by file. Used to say where a value is set. */
    readonly envSources: ReadonlyMap<string, Readonly<Record<string, string>>>;
    /** The config file (relative to `cwd`), when one was found. */
    readonly configPath?: string;
    /** Why no config file was found. */
    readonly configError?: Error;
    /** The text of the config file. */
    readonly configText?: string;
    /** The instance, when the config file loaded. */
    readonly cms?: Cms;
    /** Why the config file did not load. */
    readonly loadError?: unknown;
}
export interface CoreCheck {
    readonly group: string;
    readonly id: string;
    readonly title: string;
    /** Needs the loaded instance. Reported as skipped when the config did not load. */
    readonly needsCms?: boolean;
    run(state: DoctorState): CheckOutcome | Promise<CheckOutcome>;
}
/** Where a variable is set, for the `where` of a message: the env files that define it, else the environment. */
export declare function whereSet(state: DoctorState, name: string): string;
/** The checks of core itself, in the order they are listed. */
export declare const CORE_CHECKS: readonly CoreCheck[];
/** The order the groups are printed in. */
export declare const GROUP_ORDER: readonly ["config", "schema", "database", "secrets", "auth", "next", "upgrade"];
