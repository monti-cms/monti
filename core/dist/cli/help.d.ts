/** The help of the whole command line. */
export declare const HELP: string;
/** The help of one command: its section, under a usage line. `undefined` for a name that is not a command with a section (a plugin command prints its own). */
export declare function helpFor(command: string): string | undefined;
