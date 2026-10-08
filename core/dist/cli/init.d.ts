import { type PackageManager } from "./init-detect.js";
import { type InitAnswerFlags, InitCancelled, type Prompter } from "./init-prompts.js";
import { type InitAnswers } from "./templates.js";
/**
 * `monti init`: adds Monti to an existing Next app. It reads the app, asks (or takes flags, or defaults), writes only Monti's own new files (the config, the schema,
 * the three Next files, `.env.example`), installs the packages after a confirmation, and ends with a plain summary of what is left, numbered, with exact content to
 * copy. It edits no file the app already has, writes no `.env.local` and never touches the database.
 *
 * Safety: every write goes through {@link ProjectWriter}, which refuses a path outside the project. An existing file is never overwritten unless the person says yes
 * (or passes `overwrite`). Nothing is written until every question is answered, so cancelling leaves the project as it was.
 */
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
    /** Packages installed (or to install, on a dry run). */
    installed: string[];
    readonly steps: InitStep[];
    /** Things worth knowing that need no action. */
    readonly notes: string[];
    /** What is left to do, in order, with exact values. */
    readonly next: string[];
}
/** An error after files were already written. `written` lists them, so the message can say what is on disk. */
export declare class InitError extends Error {
    readonly written: readonly string[];
    constructor(message: string, written: readonly string[]);
}
/** Writes only inside the project folder: an absolute path, a `..` path, or a path that goes through a symlink out of the folder is refused. */
export declare class ProjectWriter {
    private readonly root;
    readonly written: string[];
    constructor(cwd: string);
    /** The absolute path of `file` if it is inside the project, else throws. */
    resolve(file: string): string;
    exists(file: string): boolean;
    read(file: string): string;
    write(file: string, content: string): void;
}
/** The real host: spawns the package manager. */
export declare const defaultInitHost: InitHost;
/**
 * The install specs of the Monti packages: while Monti is not on npm, `@monti-cms/core` is a GitHub address with `path:/core`, and each sibling is that address with its own folder.
 * With any other spec (or none) the names stay bare. Packages that are not Monti's stay bare.
 */
export declare function installSpecs(packages: readonly string[], coreSpec: string | undefined): string[];
/** Runs the whole of `monti init` in `options.cwd`. Throws {@link InitCancelled} when the person cancels, {@link InitError} when a write fails. */
export declare function initProject(options: InitOptions): Promise<InitReport>;
/** The plain summary: what was done, then what is left, numbered. */
export declare function formatInitReport(report: InitReport): string;
export { InitCancelled };
