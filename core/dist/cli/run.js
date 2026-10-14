import { parseCommandArgs } from "./command.js";
import { findCommand } from "./commands.js";
import { reportError } from "./exit.js";
import { HELP, helpFor } from "./help.js";
import { isPluginCommandName, runPluginCommand } from "./plugin-command.js";
/** Runs the command and returns the exit code. */
export async function runCli(argv, io = { cwd: process.cwd(), log: console.log, error: console.error }) {
    const [name, ...rest] = argv;
    const json = rest.includes("--json");
    try {
        if (name === undefined || name === "help" || name === "--help" || name === "-h") {
            io.log(HELP);
            return 0;
        }
        const command = findCommand(name);
        if (command) {
            // `monti <command> --help` prints that command's section only.
            if (rest.includes("--help") || rest.includes("-h")) {
                io.log(helpFor(command.name) ?? HELP);
                return 0;
            }
            const { values, app } = parseCommandArgs(command, rest);
            return await command.run({ ...io, values, app });
        }
        // A plugin command has its own options, known once the app is loaded; it answers `--help` itself.
        if (isPluginCommandName(name))
            return await runPluginCommand(io, name, rest);
        io.error(`Unknown command: ${name}\n\n${HELP}`);
        return 1;
    }
    catch (error) {
        return reportError(error, io, { json });
    }
}
