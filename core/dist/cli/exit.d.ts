import type { CliContext } from "./command.js";
/** The exit code of `monti` when the person cancelled a question (Ctrl+C): the shell convention for an interrupt, not a failure. */
export declare const EXIT_CANCELLED = 130;
/** The exit code of any other error: a setup problem (`SetupError`), a flag that is wrong, a step that failed. */
export declare const EXIT_ERROR = 1;
/** The exit code an error that ended a command stands for. */
export declare const exitCodeFor: (error: unknown) => number;
/**
 * The one place an error that ends a command is shown and turned into an exit code. The message goes to `error`; with `--json` it goes to `log` as
 * `{ "ok": false, "error": "..." }`, so a tool that reads the output always gets JSON.
 */
export declare function reportError(error: unknown, context: CliContext, options?: {
    readonly json?: boolean;
}): number;
