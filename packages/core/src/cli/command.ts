import { parseArgs } from "node:util";
import type { InitHost } from "./init";
import type { Prompter } from "./prompt";

/**
 * What a command of the `monti` command line is: a name, its options and the function that runs it. The commands are listed in one table (`commands.ts`), the
 * runner (`run.ts`) parses the options and calls `run`, and the help texts (`help.ts`) are generated from the same table, so an option cannot be missing from one.
 */

/** What every command prints through, and the folder it works in. Nothing in a command writes to `console` directly. */
export interface CliContext {
	readonly cwd: string;
	readonly log: (message: string) => void;
	readonly error: (message: string) => void;
}

/** What `runCli` is given: the context, and the things a test replaces. */
export interface CliIo extends CliContext {
	/** Answers the questions of `monti init` and `monti admin:reset-password` (tests). Default: the terminal, when there is one. */
	readonly prompter?: Prompter;
	/** Whether a person is at the terminal (tests). Default: stdin and stdout are terminals. */
	readonly interactive?: boolean;
	/** Replaces what `monti init` reaches out of the process for, the package install (tests). */
	readonly initHost?: Partial<InitHost>;
}

/** One option of a command: what `parseArgs` needs, plus what the help says. */
export interface OptionSpec {
	readonly type: "string" | "boolean";
	readonly short?: string;
	readonly multiple?: boolean;
	/** How the value is written in the help (`<file>`); a boolean option has none. */
	readonly value?: string;
	readonly help: string;
}

export type OptionSpecs = Readonly<Record<string, OptionSpec>>;

/** The values `parseArgs` gives for the options of a command. */
export type OptionValues<O extends OptionSpecs> = {
	readonly [K in keyof O]?: O[K]["type"] extends "boolean"
		? boolean
		: O[K]["multiple"] extends true
			? string[]
			: string;
};

/** The options of every command that loads the app (`monti.config.ts`): parsed once, here. */
export const APP_OPTIONS = {
	"env-file": {
		type: "string",
		multiple: true,
		value: "<file>",
		help: "Env file to read (repeatable, default .env.local and .env)",
	},
	"no-env-file": { type: "boolean", help: "Don't read any env file" },
	config: {
		type: "string",
		value: "<file>",
		help: "The config file that exports the CMS instance (default: ./monti.config.ts, ./src/monti.config.ts)",
	},
} as const satisfies OptionSpecs;

/** The app options as the commands use them. */
export interface AppFlags {
	/** Env files to read. If unset, `.env.local` and `.env` (only those that exist); an empty array reads none. */
	readonly envFiles?: readonly string[];
	/** Config file (`monti.config.ts`): the module that exports the CMS instance. */
	readonly config?: string;
}

/** The app options out of parsed values: `--no-env-file` reads none, `--env-file` names the files. */
export const appFlagsOf = (values: OptionValues<typeof APP_OPTIONS>): AppFlags => ({
	envFiles: values["no-env-file"] ? [] : values["env-file"],
	config: values.config,
});

export interface CommandContext<O extends OptionSpecs = OptionSpecs> extends CliIo {
	/** The options the command declares, parsed. */
	readonly values: OptionValues<O>;
	/** The shared app options; `{}` for a command that does not load the app. */
	readonly app: AppFlags;
}

/** What a command that loads the app passes on: the context and the app options. */
export const appOptionsOf = (
	context: CommandContext,
): { cwd: string; log: CliContext["log"]; error: CliContext["error"] } & AppFlags => ({
	cwd: context.cwd,
	log: context.log,
	error: context.error,
	...context.app,
});

export interface Command {
	readonly name: string;
	/** What the command does, for the help (continuation lines are indented by the help). */
	readonly summary: string;
	/** The options of the command itself, in the order the help lists them. */
	readonly options: OptionSpecs;
	/** The command loads the app, so it also takes {@link APP_OPTIONS}. */
	readonly app: boolean;
	/** Runs the command and returns its exit code. An error it throws is reported, and ends the command, by the runner. */
	run(context: CommandContext): Promise<number>;
}

/** Declares a command; the options typed here give `context.values` its type. */
export function defineCommand<const O extends OptionSpecs>(definition: {
	readonly name: string;
	readonly summary: string;
	readonly options: O;
	readonly app?: boolean;
	run(context: CommandContext<O>): Promise<number>;
}): Command {
	return { app: false, ...definition } as unknown as Command;
}

/** Parses the arguments of a command against its options (and the app options). Throws on an option it does not know. */
export function parseCommandArgs(
	command: Command,
	argv: readonly string[],
): { readonly values: OptionValues<OptionSpecs>; readonly app: AppFlags } {
	const specs: OptionSpecs = command.app ? { ...command.options, ...APP_OPTIONS } : command.options;
	const options = Object.fromEntries(
		Object.entries(specs).map(([name, { type, short, multiple }]) => [
			name,
			{ type, ...(short ? { short } : {}), ...(multiple ? { multiple } : {}) },
		]),
	);
	const { values } = parseArgs({ args: [...argv], options });
	return {
		values: values as OptionValues<OptionSpecs>,
		app: command.app ? appFlagsOf(values as OptionValues<typeof APP_OPTIONS>) : {},
	};
}

/** How an option is written in the help: `--yes, -y`, `--site-url <url>`. */
export const optionLabel = (name: string, option: OptionSpec): string =>
	`--${name}${option.value ? ` ${option.value}` : ""}${option.short ? `, -${option.short}` : ""}`;

/**
 * The help lines of some options, one block per option: the label, then what it does in a column, a text of several lines continuing in that column.
 * `width` is the width of the label column (default: the longest label of these options).
 */
export function optionLines(specs: OptionSpecs, width?: number): string[] {
	const entries = Object.entries(specs).map(([name, option]) => [optionLabel(name, option), option] as const);
	const column = width ?? Math.max(0, ...entries.map(([label]) => label.length)) + 3;
	return entries.flatMap(([label, option]) => {
		const [first = "", ...rest] = option.help.split("\n");
		return [`${INDENT}${label.padEnd(column)}${first}`, ...rest.map((line) => `${INDENT}${" ".repeat(column)}${line}`)];
	});
}

/** The indent of the option lines of a help section. */
export const INDENT = "              ";
