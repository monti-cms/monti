import { parseArgs } from "node:util";
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
};
/** The app options out of parsed values: `--no-env-file` reads none, `--env-file` names the files. */
export const appFlagsOf = (values) => ({
    envFiles: values["no-env-file"] ? [] : values["env-file"],
    config: values.config,
});
/** What a command that loads the app passes on: the context and the app options. */
export const appOptionsOf = (context) => ({
    cwd: context.cwd,
    log: context.log,
    error: context.error,
    ...context.app,
});
/** Declares a command; the options typed here give `context.values` its type. */
export function defineCommand(definition) {
    return { app: false, ...definition };
}
/** Parses the arguments of a command against its options (and the app options). Throws on an option it does not know. */
export function parseCommandArgs(command, argv) {
    const specs = command.app ? { ...command.options, ...APP_OPTIONS } : command.options;
    const options = Object.fromEntries(Object.entries(specs).map(([name, { type, short, multiple }]) => [
        name,
        { type, ...(short ? { short } : {}), ...(multiple ? { multiple } : {}) },
    ]));
    const { values } = parseArgs({ args: [...argv], options });
    return {
        values: values,
        app: command.app ? appFlagsOf(values) : {},
    };
}
/** How an option is written in the help: `--yes, -y`, `--site-url <url>`. */
export const optionLabel = (name, option) => `--${name}${option.value ? ` ${option.value}` : ""}${option.short ? `, -${option.short}` : ""}`;
/**
 * The help lines of some options, one block per option: the label, then what it does in a column, a text of several lines continuing in that column.
 * `width` is the width of the label column (default: the longest label of these options).
 */
export function optionLines(specs, width) {
    const entries = Object.entries(specs).map(([name, option]) => [optionLabel(name, option), option]);
    const column = width ?? Math.max(0, ...entries.map(([label]) => label.length)) + 3;
    return entries.flatMap(([label, option]) => {
        const [first = "", ...rest] = option.help.split("\n");
        return [`${INDENT}${label.padEnd(column)}${first}`, ...rest.map((line) => `${INDENT}${" ".repeat(column)}${line}`)];
    });
}
/** The indent of the option lines of a help section. */
export const INDENT = "              ";
