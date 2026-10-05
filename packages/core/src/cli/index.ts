import { parseArgs } from "node:util";
import { contentRewrite } from "./content-rewrite";
import { formatInitReport, initProject } from "./init";
import { migrate } from "./migrate";

/**
 * The `monti` command line (package `bin`). `bin/monti.mjs` registers tsx and then calls it.
 *
 * - `monti init [--admin-path /admin] [--locale en] [--time-zone UTC]`: creates config and route files in a Next app and wires up tsconfig, CSS and the next config.
 * - `monti migrate [--env-file .env.local] [--no-env-file] [--config <file>] [--server <file>]`: creates the DB tables.
 * - `monti content:rewrite [--apply] [--env-file …] [--no-env-file] [--config <file>] [--server <file>]`: re-serializes every stored body with the site's syntax (a dry run unless `--apply`).
 */

export { type ConfigPaths, parseJsonc, resolveConfigPaths } from "./config-paths";
export { type ContentRewriteOptions, contentRewrite } from "./content-rewrite";
export { DEFAULT_ENV_FILES, loadEnvFiles } from "./env";
export { formatInitReport, type InitOptions, type InitReport, initProject } from "./init";
export { type MigrateOptions, migrate } from "./migrate";

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
  content:rewrite   Re-serialize every stored body (working, published, templates) with the site's syntax
                    Prints "collection/slug (locale) state: changed|unchanged" per body and a summary; run it after "monti migrate"
              --apply               Write the changes (default: a dry run that writes nothing)
              --env-file, --no-env-file, --config, --server   As for migrate
`;

export interface CliIo {
	readonly cwd: string;
	readonly log: (message: string) => void;
	readonly error: (message: string) => void;
}

/** Runs the command and returns the exit code. */
export async function runCli(
	argv: readonly string[],
	io: CliIo = { cwd: process.cwd(), log: console.log, error: console.error },
): Promise<number> {
	const [command, ...rest] = argv;
	try {
		if (command === "init") {
			const { values } = parseArgs({
				args: [...rest],
				options: { "admin-path": { type: "string" }, locale: { type: "string" }, "time-zone": { type: "string" } },
			});
			io.log(
				formatInitReport(
					initProject({
						cwd: io.cwd,
						adminPath: values["admin-path"],
						locale: values.locale,
						timeZone: values["time-zone"],
					}),
				),
			);
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
		if (command === "content:rewrite") {
			const { values } = parseArgs({
				args: [...rest],
				options: {
					apply: { type: "boolean" },
					"env-file": { type: "string", multiple: true },
					"no-env-file": { type: "boolean" },
					config: { type: "string" },
					server: { type: "string" },
				},
			});
			const ok = await contentRewrite({
				cwd: io.cwd,
				apply: values.apply === true,
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
	} catch (error) {
		io.error(error instanceof Error ? error.message : String(error));
		return 1;
	}
}
