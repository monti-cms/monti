import type { DoctorReport } from "./doctor";
import type { InitAnswers } from "./init-answers";
import type { PackageManager } from "./init-detect";
import type { InitAnswerFlags } from "./init-prompts";
import type { Prompter } from "./prompt";

/** The options, host and report of `monti init`. */

/** A package manager command `monti init` runs to install packages. */
export interface InstallCommand {
	readonly command: string;
	readonly args: readonly string[];
	readonly cwd: string;
}

/** The things `monti init` reaches out of the process for. Tests replace them; the defaults are the real thing. */
export interface InitHost {
	/** Installs packages with the package manager. Throws when it fails. */
	install(command: InstallCommand): void | Promise<void>;
	/** The time zone of this computer (an IANA name), or `undefined` when it cannot be read. */
	systemTimeZone(): string | undefined;
	/** The environment `DATABASE_URL` is looked up in. */
	environment(): Record<string, string | undefined>;
	/** `monti db:setup` for the app in `cwd`. Throws, with the reason, when it fails. */
	setupDatabase(cwd: string): Promise<void>;
	/** `monti doctor` for the app in `cwd`. Throws when it cannot run at all. */
	runDoctor(cwd: string): Promise<DoctorReport>;
}

export interface InitOptions extends InitAnswerFlags {
	/** Next app folder (where `package.json` is). */
	readonly cwd: string;
	/** A person is at the terminal: ask the questions that have no flag. Without it nothing is asked. */
	readonly prompter?: Prompter;
	/** Work out and report everything, write and run nothing. */
	readonly dryRun?: boolean;
	/** Replace existing files that differ, without asking. */
	readonly overwrite?: boolean;
	/** `false` (`--no-install`): do not install packages. */
	readonly install?: boolean;
	/** Override the detected package manager. */
	readonly packageManager?: PackageManager;
	/** `false` (`--no-setup`): do not create `.env.local`, set up the database or run the doctor; the steps are in the list of what is left. */
	readonly setup?: boolean;
	/** Progress lines while the work runs. */
	readonly log?: (message: string) => void;
	readonly host?: Partial<InitHost>;
}

export interface InitStep {
	readonly name: string;
	readonly status: "done" | "skipped" | "failed" | "planned";
	readonly detail?: string;
}

export interface InitReport {
	/** `false` when the install step failed. The files are still written. */
	ok: boolean;
	readonly dryRun: boolean;
	readonly app: {
		readonly name?: string;
		readonly next?: string;
		readonly src: boolean;
		readonly packageManager: PackageManager;
		readonly typescript: boolean;
		readonly contentFolders: readonly { readonly dir: string; readonly files: number }[];
	};
	/** What was decided. */
	readonly answers: InitAnswers;
	/** Newly created files (relative to `cwd`). */
	readonly created: string[];
	/** Files that already existed and were left as they are. */
	skipped: string[];
	/** Existing files that were replaced (only on a yes or `overwrite`). */
	readonly overwritten: string[];
	/** Files of the app that init edited (or would, on a dry run), with the change in one line. */
	readonly changed: { readonly file: string; readonly change: string }[];
	/** Packages installed (or to install, on a dry run). */
	installed: string[];
	readonly steps: InitStep[];
	/** Things worth knowing that need no action. */
	readonly notes: string[];
	/** What is left to do, in order, with exact values. */
	readonly next: string[];
}
