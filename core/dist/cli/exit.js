import { Cancelled } from "./prompt.js";
/** The exit code of `monti` when the person cancelled a question (Ctrl+C): the shell convention for an interrupt, not a failure. */
export const EXIT_CANCELLED = 130;
/** The exit code of any other error: a setup problem (`SetupError`), a flag that is wrong, a step that failed. */
export const EXIT_ERROR = 1;
/** The exit code an error that ended a command stands for. */
export const exitCodeFor = (error) => (error instanceof Cancelled ? EXIT_CANCELLED : EXIT_ERROR);
/**
 * The one place an error that ends a command is shown and turned into an exit code. The message goes to `error`; with `--json` it goes to `log` as
 * `{ "ok": false, "error": "..." }`, so a tool that reads the output always gets JSON.
 */
export function reportError(error, context, options = {}) {
    const message = error instanceof Error ? error.message : String(error);
    if (options.json)
        context.log(JSON.stringify({ ok: false, error: message }, null, 2));
    else
        context.error(message);
    return exitCodeFor(error);
}
