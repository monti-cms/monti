import { type CliContext } from "./command.js";
/** Whether `name` has the shape of a plugin command (`git-sync:pull`). */
export declare const isPluginCommandName: (name: string) => boolean;
/**
 * `monti <plugin>:<command> [options]`: loads the app's CMS instance, finds the command in the server side of the named plugin and runs it with the instance.
 * The options of the command are the ones it declares plus the app options (`--env-file`, `--no-env-file`, `--config`). Returns the exit code.
 */
export declare function runPluginCommand(context: CliContext, fullName: string, argv: readonly string[]): Promise<number>;
