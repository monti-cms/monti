import type { Command } from "./command.js";
/** Every command of the `monti` command line, in the order the help lists them. (`<plugin>:<command>` is not here: the plugins of the app decide it.) */
export declare const COMMANDS: readonly Command[];
/** The command with this name, if there is one. */
export declare const findCommand: (name: string) => Command | undefined;
