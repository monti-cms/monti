import type { InitPlan } from "./init-plan.js";
import type { InitReport } from "./init-types.js";
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
/**
 * Writes the plan: the new files (and the replaced ones), then the edits to the app's own files, and records each in the report. On a dry run nothing is written and the
 * report says what would be. Throws {@link InitError} when a write fails, naming the files already written.
 */
export declare function applyPlan(plan: InitPlan, writer: ProjectWriter, report: InitReport, dryRun: boolean): void;
