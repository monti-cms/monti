import { parseArgs } from "node:util";
import { addComponents, formatAddReport } from "./add";
import { eventsRetry } from "./events";
import { IMPORT_HELP, runImportCommand } from "./import/command";
import { findBoundaryViolations, formatBoundaryViolations } from "./import-boundary";
import { runInitCommand } from "./init-command";
import type { Prompter } from "./init-prompts";
import { migrate } from "./migrate";
import { isPluginCommandName, runPluginCommand } from "./plugin-command";
import { schemaApply, schemaDiff } from "./schema-apply";
import { extractSchema, formatExtractReport } from "./schema-extract";
import { generateSchemaTypes, watchSchemaTypes } from "./schema-types";

/**
 * The `monti` command line (package `bin`). `bin/monti.mjs` registers tsx and then calls it.
 *
 * - `monti init [--yes] [--json] [--dry-run] [question flags]`: adds Monti to an existing Next app: asks (or takes flags), writes `monti.config.ts`, the schema file and the Next files, installs the packages and runs the migrations. See `monti init --help`.
 * - `monti add <name...> [--registry <url|path>] [--overwrite] [--dry-run]`: copies components from the registry into the app as source and installs what they need.
 * - `monti import <path> [--dry-run] [--publish] [--collection <name>] [--format <name>] [--mapping <file>] [--yes] [--json] [--overwrite] [env options]`: imports existing `.md` and `.mdx` posts through the CMS.
 * - `monti migrate [--env-file .env.local] [--no-env-file] [--config <file>]`: creates the DB tables.
 * - `monti events:retry [--all] [--limit <n>] [--env-file <file>] [--no-env-file] [--config <file>]`: delivers the `afterCommit` events that are due (for a cron job).
 * - `monti <plugin>:<command> [options]`: runs a command a plugin adds (`CmsServerPlugin.commands`), for example `monti git-sync:pull`.
 * - `monti check:boundary`: fails when a client component (`"use client"`) imports `monti.config.ts` or another server-only module, directly or through other files.
 * - `monti schema:types [--schema <file>] [--out <file>] [--watch] [--check]`: writes the types of `monti.schema.json`.
 * - `monti schema:extract [--config <file>] [--out <file>] [--overwrite] [--locale <code>] [--no-types]`: writes the data part of the config file to `monti.schema.json`.
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
export { CONFIG_CANDIDATES, parseJsonc, resolveConfigPath } from "./config-paths";
export { DEFAULT_ENV_FILES, loadEnvFiles } from "./env";
export { type EventsRetryOptions, eventsRetry } from "./events";
export {
	formatReport,
	IMPORT_HELP,
	type ImportCommandIo,
	ImportError,
	type ImportMapping,
	type ImportOptions,
	type ImportReport,
	MAPPING_FILE,
	runImport,
	runImportCommand,
	scriptedPrompter,
} from "./import";
export {
	type BoundaryViolation,
	findBoundaryViolations,
	formatBoundaryViolations,
	SERVER_ONLY_MODULES,
} from "./import-boundary";
export {
	formatInitReport,
	InitError,
	type InitHost,
	type InitOptions,
	type InitReport,
	initProject,
	unifiedDiff,
} from "./init";
export { type DetectedApp, detectApp } from "./init-detect";
export { collectAnswers, type InitAnswerFlags, InitCancelled, type Prompter } from "./init-prompts";
export { type MigrateOptions, migrate } from "./migrate";
export { isPluginCommandName, type PluginCommandRun, runPluginCommand } from "./plugin-command";
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
  init      Add Monti to an existing Next app (App Router): asks a few questions, writes explicit files, installs the packages and runs the migrations.
            Existing files are never overwritten without a yes. Every question has a flag; with --yes, --json, or no terminal nothing is asked.
              --yes, -y             Take the default for every question that has no flag
              --json                Print the result as JSON (implies --yes)
              --dry-run             Show what would be written and run, and change nothing
              --database <v>        A postgres:// URL, "docker" (a local Postgres, writes docker-compose.yml and starts it) or "skip" (default skip)
              --admin-github-id <n> Numeric GitHub id of the admin (MONTI_ADMIN_GITHUB_ID in .env.local)
              --site-url <url>      Public site URL, for the GitHub OAuth callback URL (default http://localhost:3000)
              --locales <list>      Language codes, the default first (default en); --locale <code> is the same for one
              --time-zone <tz>      IANA time zone for dates and times (default UTC)
              --storage <s3|none>   Image storage: an S3-compatible store (S3, R2, MinIO), or none for now (default none)
              --extras <list>       ai, git-sync, or none (default none)
              --blocks <list>       all, none, or block names: callout, collapsible, tabs, columns, code-explorer, mermaid, chart, tooltip, code-ref, color (default all)
              --admin-path <path>   Admin screen path (default /studio)
              --blog-theme          Also add the blog theme pages (monti add blog-theme); --no-blog-theme to skip (default skip)
              --overwrite           Replace existing files that differ (default: keep them)
              --no-install          Do not install packages (and so do not migrate or add the theme)
              --no-migrate          Do not run monti migrate
              --no-docker-start     Write docker-compose.yml but do not start it
              --package-manager <m> npm, pnpm, yarn or bun (default: detected)
  add       Copy components from the registry into the app as source you own, and install their npm packages
              <name...>             Components to add; the ones they need come along
              --registry <url|path> Registry folder or URL with registry.json (default: the registry of this repo)
              --overwrite           Replace files that differ from the registry (default: stop and write nothing)
              --dry-run             Show what would be written and installed
${IMPORT_HELP}  migrate   Create or update the tables in the database of monti.config.ts
              --env-file <file>     Env file to read (repeatable, default .env.local and .env)
              --no-env-file         Don't read any env file
              --config <file>       The config file that exports the CMS instance (default: ./monti.config.ts, ./src/monti.config.ts)
  events:retry    Deliver the afterCommit events that are due: retries of failed deliveries, and events a stopped process never delivered (run it from a cron job)
              --all                 Also try the failed deliveries that are not due yet
              --limit <n>           Most deliveries to try (default 100)
              --env-file <file>, --no-env-file, --config <file>   As for migrate
  <plugin>:<command>    Run a command a plugin adds, with the app loaded as for migrate (for example git-sync:pull). Add --help for its options
  check:boundary  Fail when a client component ("use client") imports monti.config.ts or another server-only module, directly or through other files
  schema:types    Write the types of the schema file (monti-env.d.ts), so collections and locales are typed without writing types
              --schema <file>       Schema file (default: ./monti.schema.json, ./src/monti.schema.json)
              --out <file>          Declaration file (default: monti-env.d.ts next to the schema file)
              --watch               Keep running and rewrite the types when the schema file changes
              --check               Write nothing; exit 1 if the declaration file is out of date
  schema:extract  Write the data part of the config file to monti.schema.json and list what stays in code
              --config <file>       Config file (default: ./monti.config.ts, then ./cms.config.ts; each also under ./src)
              --out <file>          Schema file to write (default: monti.schema.json next to the config file)
              --overwrite           Replace the schema file if it exists
              --locale <code>       Language for labels plugins provide (default: the admin language)
              --no-types            Do not write the declaration file
  schema:diff     Compare the schema with the one last applied to the database and list the stored entries each change touches (read-only)
              --schema <file>       Schema file (default: ./monti.schema.json, ./src/monti.schema.json)
              --check               Exit 1 when there is anything to apply
              --env-file <file>, --no-env-file, --config <file>   As for migrate
  schema:apply    Run the data transforms of the schema file (migrations) once each, record the schema, and raise schemaVersion in the file when the schema changed
              --schema <file>       Schema file (default: ./monti.schema.json, ./src/monti.schema.json)
              --dry-run             Run everything in a transaction that is rolled back, and write nothing
              --env-file <file>, --no-env-file, --config <file>   As for migrate
`;

export interface CliIo {
	readonly cwd: string;
	readonly log: (message: string) => void;
	readonly error: (message: string) => void;
	/** Answers the questions of `monti import` (tests). Default: the terminal, when there is one. */
	readonly prompter?: Prompter;
}

/** Runs the command and returns the exit code. */
export async function runCli(
	argv: readonly string[],
	io: CliIo = { cwd: process.cwd(), log: console.log, error: console.error },
): Promise<number> {
	const [command, ...rest] = argv;
	try {
		if (command === "init") {
			if (rest.includes("--help") || rest.includes("-h")) {
				io.log(HELP);
				return 0;
			}
			return await runInitCommand(rest, io);
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
		if (command === "import") {
			return await runImportCommand(rest, io);
		}
		if (command === "migrate") {
			const { values } = parseArgs({
				args: [...rest],
				options: {
					"env-file": { type: "string", multiple: true },
					"no-env-file": { type: "boolean" },
					config: { type: "string" },
				},
			});
			const ok = await migrate({
				cwd: io.cwd,
				envFiles: values["no-env-file"] ? [] : values["env-file"],
				config: values.config,
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
					config: { type: "string" },
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
				config: values.config,
				log: io.log,
				all: values.all,
				limit,
			});
			return ok ? 0 : 1;
		}
		if (command === "check:boundary") {
			const violations = findBoundaryViolations(io.cwd);
			if (violations.length > 0) {
				io.error(formatBoundaryViolations(violations));
				return 1;
			}
			io.log("check:boundary: no client component imports server-only code");
			return 0;
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
					config: { type: "string" },
					check: { type: "boolean" },
					"dry-run": { type: "boolean" },
				},
			});
			const options = {
				cwd: io.cwd,
				schema: values.schema,
				envFiles: values["no-env-file"] ? [] : values["env-file"],
				config: values.config,
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
		if (command !== undefined && isPluginCommandName(command)) {
			return await runPluginCommand({ cwd: io.cwd, command, argv: rest, log: io.log, error: io.error });
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
