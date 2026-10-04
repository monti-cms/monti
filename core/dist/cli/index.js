import { parseArgs } from "node:util";
import { formatInitReport, initProject } from "./init.js";
import { migrate } from "./migrate.js";
/**
 * The `monti` command line (package `bin`). `bin/monti.mjs` registers tsx and then calls it.
 *
 * - `monti init [--admin-path /admin] [--locale en] [--time-zone UTC]`: creates config and route files in a Next app and wires up tsconfig, CSS and the next config.
 * - `monti migrate [--env-file .env.local] [--no-env-file] [--config <file>] [--server <file>]`: creates the DB tables.
 */
export { parseJsonc, resolveConfigPaths } from "./config-paths.js";
export { DEFAULT_ENV_FILES, loadEnvFiles } from "./env.js";
export { formatInitReport, initProject } from "./init.js";
export { migrate } from "./migrate.js";
const HELP = `Usage: monti <command> [options]

Commands:
  init      Create the CMS files in a Next app (existing files are never overwritten)
              --admin-path <path>   Admin screen path (default /admin)
              --locale <code>       Default site language, also the admin language (default en)
              --time-zone <tz>      IANA time zone for dates and times (default UTC)
  migrate   Create or update the tables in the database of the server config
              --env-file <file>     Env file to read (repeatable, default .env.local and .env)
              --no-env-file         Don't read any env file
              --config <file>       Site config (default: @cms-config in tsconfig paths, ./cms.config.ts, ./src/cms.config.ts)
              --server <file>       Server config (default: cms.server.ts, looked up the same way)
`;
/** Runs the command and returns the exit code. */
export async function runCli(argv, io = { cwd: process.cwd(), log: console.log, error: console.error }) {
    const [command, ...rest] = argv;
    try {
        if (command === "init") {
            const { values } = parseArgs({
                args: [...rest],
                options: { "admin-path": { type: "string" }, locale: { type: "string" }, "time-zone": { type: "string" } },
            });
            io.log(formatInitReport(initProject({
                cwd: io.cwd,
                adminPath: values["admin-path"],
                locale: values.locale,
                timeZone: values["time-zone"],
            })));
            return 0;
        }
        if (command === "migrate") {
            const { values } = parseArgs({
                args: [...rest],
                options: {
                    "env-file": { type: "string", multiple: true },
                    "no-env-file": { type: "boolean" },
                    config: { type: "string" },
                    server: { type: "string" },
                },
            });
            const ok = await migrate({
                cwd: io.cwd,
                envFiles: values["no-env-file"] ? [] : values["env-file"],
                config: values.config,
                server: values.server,
                log: io.log,
            });
            return ok ? 0 : 1;
        }
        if (command === undefined || command === "help" || command === "--help" || command === "-h") {
            io.log(HELP);
            return 0;
        }
        io.error(`Unknown command: ${command}\n\n${HELP}`);
        return 1;
    }
    catch (error) {
        io.error(error instanceof Error ? error.message : String(error));
        return 1;
    }
}
