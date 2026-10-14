import { APP_OPTIONS, optionLabel, optionLines } from "./command.js";
import { COMMANDS, findCommand } from "./commands.js";
/**
 * The help texts of the `monti` command line, generated from the command table (`commands.ts`): the summary and the options of each command are declared once,
 * beside the command, so the help cannot miss an option. Each command has a section, so `monti <command> --help` prints only that command's, and `monti --help` prints
 * the header and every section. A section is a two-space indented block that starts with the command name.
 */
/** Where the text of a command starts, after its name. */
const SUMMARY_INDENT = " ".repeat(12);
const PLUGIN_SECTION = `  <plugin>:<command>    Run a command a plugin adds, with the app loaded as for db:migrate (for example git-sync:pull). Add --help for its options
`;
/** The help section of one command: its name and summary, then its options (and the app options, for a command that loads the app). */
function sectionOf(command) {
    const [first = "", ...rest] = command.summary.split("\n");
    const specs = command.app ? { ...command.options, ...APP_OPTIONS } : command.options;
    // One label column for the whole section, so the descriptions line up.
    const width = Math.max(0, ...Object.entries(specs).map(([name, option]) => optionLabel(name, option).length)) + 3;
    return [
        `  ${command.name.padEnd(SUMMARY_INDENT.length - 4)}  ${first}`,
        ...rest.map((line) => `${SUMMARY_INDENT}${line}`),
        ...optionLines(specs, width),
        "",
    ].join("\n");
}
const HEADER = `Usage: monti <command> [options]

Install first: \`monti\` is the command of the package @monti-cms/core, so add that package to your app, then run the command through your package manager
(pnpm exec monti init, npx monti init, yarn monti init or bunx monti init). Running \`npx monti\` before the install fetches a different package called "monti".
\`monti <command> --help\` shows the options of one command.

Commands:
`;
/** The help of the whole command line. */
export const HELP = `${HEADER}${COMMANDS.map(sectionOf).join("")}${PLUGIN_SECTION}`;
/** The help of one command: its section, under a usage line. `undefined` for a name that is not a command with a section (a plugin command prints its own). */
export function helpFor(command) {
    const found = findCommand(command);
    return found === undefined ? undefined : `Usage: monti ${command} [options]\n\n${sectionOf(found)}`;
}
