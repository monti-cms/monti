import { parseArgs } from "node:util";
import { addComponents, formatAddReport } from "./add";
import { eventsRetry } from "./events";
import { formatInitReport, initProject } from "./init";
import { migrate } from "./migrate";
import { schemaApply, schemaDiff } from "./schema-apply";
import { extractSchema, formatExtractReport } from "./schema-extract";
import { generateSchemaTypes, watchSchemaTypes } from "./schema-types";

/**
 * The `monti` command line (package `bin`). `bin/monti.mjs` registers tsx and then calls it.
 *
 * - `monti init [--admin-path /admin] [--locale en] [--time-zone UTC]`: creates config and route files in a Next app and wires up tsconfig, CSS and the next config.
 * - `monti add <name...> [--registry <url|path>] [--overwrite] [--dry-run]`: copies components from the registry into the app as source and installs what they need.
 * - `monti migrate [--env-file .env.local] [--no-env-file] [--server <file>]`: creates the DB tables.
 * - `monti events:retry [--all] [--limit <n>] [--env-file <file>] [--no-env-file] [--server <file>]`: delivers the `afterCommit` events that are due (for a cron job).
 * - `monti schema:types [--schema <file>] [--out <file>] [--watch] [--check]`: writes the types of `monti.schema.json`.
 * - `monti schema:extract [--config <file>] [--out <file>] [--overwrite] [--locale <code>] [--no-types]`: writes the data part of `cms.config.ts` to `monti.schema.json`.
 * - `monti schema:diff [--schema <file>] [--check] [env options]`: compares the schema with the one last applied to the database and lists the stored entries each change touches.
 * - `monti schema:apply [--schema <file>] [--dry-run] [env options]`: runs the data transforms of the schema file (`migrations`) once each and records the schema and its version.
 */

export {
	type AddOptions,
	type AddReport,
	addComponents,
	DEFAULT_COMPONENTS_ALIAS,
	detectPackageManager,
	formatAddReport,
	type InstallCommand,
	rewriteRegistryImports,
} from "./add";
export { parseJsonc, resolveServerPath } from "./config-paths";
export { DEFAULT_ENV_FILES, loadEnvFiles } from "./env";
export { type EventsRetryOptions, eventsRetry } from "./events";
export { formatInitReport, type InitOptions, type InitReport, initProject } from "./init";
export { type MigrateOptions, migrate } from "./migrate";
export { DEFAULT_REGISTRY_URL, type RegistryItem, readItem, resolveItems } from "./registry";
export {
	formatApplyResult,
	formatSchemaPlan,
	type SchemaApplyOutcome,
	type SchemaCommandOptions,
	type SchemaDiffResult,
	schemaApply,
	schemaDiff,
	withSchemaVersion,
} from "./schema-apply";
export {
	CONFIG_FILE_CANDIDATES,
	type ExtractedSchema,
	type ExtractOptions,
	type ExtractReport,
	extractSchema,
	extractSchemaData,
	formatExtractReport,
	type StaysInCode,
	schemaFileText,
} from "./schema-extract";
export {
	findSchemaFile,
	generateSchemaTypes,
	SCHEMA_FILE_CANDIDATES,
	SCHEMA_LINK,
	SCHEMA_TYPES_FILE,
	type SchemaTypesOptions,
	type SchemaTypesResult,
	schemaTypesText,
	toTypeLiteral,
	watchSchemaTypes,
} from "./schema-types";

const HELP = `Usage: monti <command> [options]

Commands:
  init      Create the CMS files in a Next app (existing files are never overwritten)
              --admin-path <path>   Admin screen path (default /admin)
              --locale <code>       Default site language, also the admin language (default en)
              --time-zone <tz>      IANA time zone for dates and times (default UTC)
  add       Copy components from the registry into the app as source you own, and install their npm packages
              <name...>             Components to add; the ones they need come along
              --registry <url|path> Registry folder or URL with registry.json (default: the registry of this repo)
              --overwrite           Replace files that differ from the registry (default: stop and write nothing)
              --dry-run             Show what would be written and installed
  migrate   Create or update the tables in the database of the server config
              --env-file <file>     Env file to read (repeatable, default .env.local and .env)
              --no-env-file         Don't read any env file
              --server <file>       The server file that exports the CMS instance (default: ./cms.server.ts, ./src/cms.server.ts)
  events:retry    Deliver the afterCommit events that are due: retries of failed deliveries, and events a stopped process never delivered (run it from a cron job)
              --all                 Also try the failed deliveries that are not due yet
              --limit <n>           Most deliveries to try (default 100)
              --env-file <file>, --no-env-file, --server <file>   As for migrate
  schema:types    Write the types of the schema file (monti-env.d.ts), so collections and locales are typed without writing types
              --schema <file>       Schema file (default: ./monti.schema.json, ./src/monti.schema.json)
              --out <file>          Declaration file (default: monti-env.d.ts next to the schema file)
              --watch               Keep running and rewrite the types when the schema file changes
              --check               Write nothing; exit 1 if the declaration file is out of date
  schema:extract  Write the data part of cms.config.ts to monti.schema.json and list what stays in code
              --config <file>       Config file (default: ./cms.config.ts, ./src/cms.config.ts)
              --out <file>          Schema file to write (default: monti.schema.json next to the config file)
              --overwrite           Replace the schema file if it exists
              --locale <code>       Language for labels plugins provide (default: the admin language)
              --no-types            Do not write the declaration file
  schema:diff     Compare the schema with the one last applied to the database and list the stored entries each change touches (read-only)
              --schema <file>       Schema file (default: ./monti.schema.json, ./src/monti.schema.json)
              --check               Exit 1 when there is anything to apply
              --env-file <file>, --no-env-file, --server <file>   As for migrate
  schema:apply    Run the data transforms of the schema file (migrations) once each, record the schema, and raise schemaVersion in the file when the schema changed
              --schema <file>       Schema file (default: ./monti.schema.json, ./src/monti.schema.json)
              --dry-run             Run everything in a transaction that is rolled back, and write nothing
              --env-file <file>, --no-env-file, --server <file>   As for migrate
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
		if (command === "add") {
			const { values, positionals } = parseArgs({
				args: [...rest],
				allowPositionals: true,
				options: { registry: { type: "string" }, overwrite: { type: "boolean" }, "dry-run": { type: "boolean" } },
			});
			const report = await addComponents({
				cwd: io.cwd,
				names: positionals,
				registry: values.registry,
				overwrite: values.overwrite,
				dryRun: values["dry-run"],
			});
			io.log(formatAddReport(report));
			return report.conflicts.length > 0 && !report.dryRun ? 1 : 0;
		}
		if (command === "migrate") {
			const { values } = parseArgs({
				args: [...rest],
				options: {
					"env-file": { type: "string", multiple: true },
					"no-env-file": { type: "boolean" },
					server: { type: "string" },
				},
			});
			const ok = await migrate({
				cwd: io.cwd,
				envFiles: values["no-env-file"] ? [] : values["env-file"],
				server: values.server,
				log: io.log,
			});
			return ok ? 0 : 1;
		}
		if (command === "events:retry") {
			const { values } = parseArgs({
				args: [...rest],
				options: {
					"env-file": { type: "string", multiple: true },
					"no-env-file": { type: "boolean" },
					server: { type: "string" },
					all: { type: "boolean" },
					limit: { type: "string" },
				},
			});
			const limit = values.limit === undefined ? undefined : Number(values.limit);
			if (limit !== undefined && (!Number.isInteger(limit) || limit < 1)) {
				io.error("--limit must be a positive whole number");
				return 1;
			}
			const ok = await eventsRetry({
				cwd: io.cwd,
				envFiles: values["no-env-file"] ? [] : values["env-file"],
				server: values.server,
				log: io.log,
				all: values.all,
				limit,
			});
			return ok ? 0 : 1;
		}
		if (command === "schema:types") {
			const { values } = parseArgs({
				args: [...rest],
				options: {
					schema: { type: "string" },
					out: { type: "string" },
					watch: { type: "boolean" },
					check: { type: "boolean" },
				},
			});
			const options = { cwd: io.cwd, schema: values.schema, out: values.out, log: io.log };
			if (values.watch) {
				const stop = watchSchemaTypes(options);
				io.log("monti: watching the schema file (Ctrl+C stops)");
				await new Promise<void>((resolve) => {
					process.once("SIGINT", resolve);
					process.once("SIGTERM", resolve);
				});
				stop();
				return 0;
			}
			const result = generateSchemaTypes({ ...options, check: values.check });
			if (values.check) {
				if (result.changed) io.error(`${result.out} is out of date; run \`monti schema:types\``);
				else io.log(`${result.out} is up to date`);
				return result.changed ? 1 : 0;
			}
			io.log(result.changed ? `Wrote ${result.out} from ${result.schema}` : `${result.out} is up to date`);
			return 0;
		}
		if (command === "schema:extract") {
			const { values } = parseArgs({
				args: [...rest],
				options: {
					config: { type: "string" },
					out: { type: "string" },
					overwrite: { type: "boolean" },
					locale: { type: "string" },
					"no-types": { type: "boolean" },
				},
			});
			const report = await extractSchema({
				cwd: io.cwd,
				config: values.config,
				out: values.out,
				overwrite: values.overwrite,
				locale: values.locale,
				types: !values["no-types"],
			});
			io.log(formatExtractReport(report));
			return 0;
		}
		if (command === "schema:diff" || command === "schema:apply") {
			const { values } = parseArgs({
				args: [...rest],
				options: {
					schema: { type: "string" },
					"env-file": { type: "string", multiple: true },
					"no-env-file": { type: "boolean" },
					server: { type: "string" },
					check: { type: "boolean" },
					"dry-run": { type: "boolean" },
				},
			});
			const options = {
				cwd: io.cwd,
				schema: values.schema,
				envFiles: values["no-env-file"] ? [] : values["env-file"],
				server: values.server,
				log: io.log,
			};
			if (command === "schema:diff") {
				const result = await schemaDiff({ ...options, check: values.check });
				io.log(result.text);
				return result.exitCode;
			}
			const outcome = await schemaApply({ ...options, dryRun: values["dry-run"] });
			io.log(outcome.text);
			return outcome.ok ? 0 : 1;
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
