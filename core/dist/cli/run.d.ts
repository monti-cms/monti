import type { CliIo } from "./command.js";
/** Runs the command and returns the exit code. */
export declare function runCli(argv: readonly string[], io?: CliIo): Promise<number>;
