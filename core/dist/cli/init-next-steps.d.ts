import type { InitAnswers } from "./init-answers.js";
import type { PackageManager } from "./init-detect.js";
import type { InstallCommand } from "./init-types.js";
/** The last stage of `monti init`: the plain list of what is left, in order, with the exact content to copy. */
export interface NextStepsInput {
    readonly cwd: string;
    readonly manager: PackageManager;
    readonly answers: InitAnswers;
    readonly typescript: boolean;
    /** The config file (relative to the project), for the step that names the repo to sync. */
    readonly configFile: string;
    /** The packages that were missing and the command that installs them. */
    readonly missing: readonly string[];
    readonly installCommand: InstallCommand;
    /** The packages are (or, on a dry run, would be) installed by init, so the person does not have to. */
    readonly willInstall: boolean;
    /** Steps for the files init could not edit safely. */
    readonly manual: readonly string[];
}
/** What is left to do after init, in order. */
export declare function nextSteps(input: NextStepsInput): string[];
