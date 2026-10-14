import type { InitAnswers } from "./init-answers.js";
import type { PackageManager } from "./init-detect.js";
import type { InitAnswerFlags } from "./init-prompts.js";
import type { Prompter } from "./prompt.js";
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
        readonly contentFolders: readonly {
            readonly dir: string;
            readonly files: number;
        }[];
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
    readonly changed: {
        readonly file: string;
        readonly change: string;
    }[];
    /** Packages installed (or to install, on a dry run). */
    installed: string[];
    readonly steps: InitStep[];
    /** Things worth knowing that need no action. */
    readonly notes: string[];
    /** What is left to do, in order, with exact values. */
    readonly next: string[];
}
