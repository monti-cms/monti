import type { InitAnswers } from "./init-answers.js";
import type { DetectedApp } from "./init-detect.js";
import type { ProjectWriter } from "./init-writer.js";
import type { Prompter } from "./prompt.js";
/**
 * The plan stage of `monti init`: from what was found in the app and what was answered, which files get written, which of the app's own files get edited, and what
 * cannot be done safely and is left to the person. Reads files (to compare and to edit their text); writes none.
 */
/** A file `monti init` writes: new, or replacing one the person said to replace. */
export interface PlannedWrite {
    readonly file: string;
    readonly content: string;
    readonly replace: boolean;
}
/** An edit to a file of the app that exists. */
export interface PlannedEdit {
    readonly file: string;
    readonly text: string;
    readonly change: string;
}
export interface InitPlan {
    readonly writes: readonly PlannedWrite[];
    readonly edits: readonly PlannedEdit[];
    /** Steps for the files init could not edit safely, with the reason, ready for the list of what is left. */
    readonly manual: readonly string[];
    /** Files that are already as they should be, or that were kept. */
    readonly skipped: readonly string[];
    /** Things worth knowing that need no action. */
    readonly notes: readonly string[];
    /** The config file (relative to the project), existing or new. */
    readonly configFile: string;
}
/** The one line that says which time zone the site got and why: automatic is fine, silent is not. */
export declare const timeZoneNote: (answers: Pick<InitAnswers, "timeZone" | "timeZoneSource">, schemaFile: string) => string;
/** What the plan needs besides the app and the answers. */
export interface PlanInput {
    readonly cwd: string;
    readonly app: DetectedApp;
    readonly answers: InitAnswers;
    /** The `--locales` flag was given (so the languages found in the files are not what was chosen). */
    readonly localesFlag: boolean;
    /** Replace existing files that differ, without asking. */
    readonly overwrite: boolean;
    /** Asked whether to replace a file that exists and differs. */
    readonly prompter?: Prompter;
    readonly writer: ProjectWriter;
}
/** Plans `monti init` for the app and the answers. May ask whether to replace a file that exists and differs. */
export declare function planProject(input: PlanInput): Promise<InitPlan>;
