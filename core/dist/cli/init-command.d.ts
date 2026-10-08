import { type InitHost } from "./init.js";
import { type Prompter } from "./init-prompts.js";
/** The `monti init` command line: flags in, the report out. Kept apart from `index.ts` so the flag list and the prompt wiring sit with the command. */
export interface InitCommandIo {
    readonly cwd: string;
    readonly log: (message: string) => void;
    readonly error: (message: string) => void;
}
export interface InitCommandExtras {
    /** A person is at the terminal. Default: stdin and stdout are terminals. */
    readonly interactive?: boolean;
    /** Replaces the prompt library (tests). */
    readonly prompter?: Prompter;
    readonly host?: Partial<InitHost>;
}
/** Runs `monti init <argv>` and returns the exit code: 0 done, 1 an error or a step that failed, 130 cancelled. */
export declare function runInitCommand(argv: readonly string[], io: InitCommandIo, extras?: InitCommandExtras): Promise<number>;
