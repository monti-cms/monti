import { existsSync, mkdirSync, readdirSync, readFileSync, rmdirSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { PackageManager } from "./init-detect";
import type { InitAnswers } from "./templates";

/**
 * What `monti init` remembers between runs, so `monti init --resume` can rerun only the steps that did not complete. The file is small, holds no secret (the
 * database URL is left out; it is in `.env.local`), and is git-ignored.
 */

export const INIT_STATE_DIR = ".monti";
export const INIT_STATE_FILE = ".monti/init.json";

/** The steps after the files are written, in the order they run. */
export const STEP_ORDER = ["docker", "install", "migrate", "typography", "theme"] as const;
export type StepId = (typeof STEP_ORDER)[number];

/** `done`: finished. `incomplete`: failed, or could not run yet; `--resume` runs it again. `skipped`: left out on purpose (a flag, no database chosen). */
export type StepState = "done" | "incomplete" | "skipped";

export interface InitState {
	readonly version: 1;
	readonly manager: PackageManager;
	/** The answers, with the database URL hidden. */
	readonly answers: InitAnswers;
	/** Packages the install step adds. */
	readonly packages: readonly string[];
	/** Whether the typography plugin is to be installed (the blog theme was chosen and the app does not have it). */
	readonly typography: boolean;
	/** The port of the Docker database, when there is one. */
	readonly dockerPort?: number;
	readonly steps: Readonly<Partial<Record<StepId, StepState>>>;
}

const isStepState = (value: unknown): value is StepState =>
	value === "done" || value === "incomplete" || value === "skipped";

/** The saved state of `cwd`, or `undefined` when there is none or it cannot be read. */
export function readInitState(cwd: string): InitState | undefined {
	const file = path.join(cwd, INIT_STATE_FILE);
	if (!existsSync(file)) return undefined;
	try {
		const value = JSON.parse(readFileSync(file, "utf8")) as Partial<InitState> | null;
		if (
			!value ||
			value.version !== 1 ||
			typeof value.manager !== "string" ||
			typeof value.answers !== "object" ||
			value.answers === null ||
			!Array.isArray(value.packages) ||
			typeof value.steps !== "object" ||
			value.steps === null ||
			!Object.values(value.steps).every(isStepState)
		) {
			return undefined;
		}
		return value as InitState;
	} catch {
		return undefined;
	}
}

export function writeInitState(cwd: string, state: InitState): void {
	const file = path.join(cwd, INIT_STATE_FILE);
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, `${JSON.stringify(state, null, "\t")}\n`);
}

/** Removes the state file (and its folder when nothing else is in it). */
export function clearInitState(cwd: string): void {
	rmSync(path.join(cwd, INIT_STATE_FILE), { force: true });
	const dir = path.join(cwd, INIT_STATE_DIR);
	try {
		if (existsSync(dir) && readdirSync(dir).length === 0) rmdirSync(dir);
	} catch {
		// a folder that cannot be removed is left
	}
}
