import { existsSync } from "node:fs";
import path from "node:path";
import type { Cms } from "../../cms";
import type { CheckOutcome } from "./outcome";

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
export function whereSet(state: DoctorState, name: string): string {
	const files = [...state.envSources].filter(([, values]) => name in values).map(([file]) => file);
	return files.length > 0 ? files.join(", ") : "the environment";
}

/** The text of an error, for a message. */
export const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

/** Whether a file exists under the app folder. */
export const exists = (state: DoctorState, file: string): boolean => existsSync(path.join(state.cwd, file));
