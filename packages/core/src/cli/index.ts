import { parseArgs } from "node:util";
import { DOCTOR_HELP, runDoctorCommand } from "./doctor";
import { eventsRetry } from "./events";
import { HELP, helpFor } from "./help";
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
 * - `monti migrate [--env-file .env.local] [--no-env-file] [--config <file>]`: creates the DB tables.
 * - `monti events:retry [--all] [--limit <n>] [--env-file <file>] [--no-env-file] [--config <file>]`: delivers the `afterCommit` events that are due (for a cron job).
 * - `monti <plugin>:<command> [options]`: runs a command a plugin adds (`CmsServerPlugin.commands`), for example `monti git-sync:pull`.
 * - `monti doctor [--json] [--only <list>] [env options]`: checks the setup (config, schema, database and migrations, secret, login, Next files, upgrade checks for the pre-overhaul setup) and says how to fix what is wrong. Includes the check that no client component (`"use client"`) imports `monti.config.ts` or another server-only module. Exits 1 when a check fails.
 * - `monti schema:types [--schema <file>] [--out <file>] [--watch] [--check]`: writes the types of `monti.schema.json`.
 * - `monti schema:extract [--config <file>] [--out <file>] [--overwrite] [--locale <code>] [--no-types]`: writes the data part of the config file to `monti.schema.json`.
 * - `monti schema:diff [--schema <file>] [--check] [env options]`: compares the schema with the one last applied to the database and lists the stored entries each change touches.
 * - `monti schema:apply [--schema <file>] [--dry-run] [env options]`: runs the data transforms of the schema file (`migrations`) once each and records the schema and its version.
 */

export { CONFIG_CANDIDATES, parseJsonc, resolveConfigPath } from "./config-paths";
export { unifiedDiff } from "./diff";
export {
	DOCTOR_HELP,
	type DoctorCommandIo,
	type DoctorOptions,
	type DoctorReport,
	type DoctorResult,
	type DoctorSummary,
	formatDoctorReport,
	runDoctor,
	runDoctorCommand,
} from "./doctor";
export { DEFAULT_ENV_FILES, loadEnvFiles } from "./env";
export { type EventsRetryOptions, eventsRetry } from "./events";
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
	type InstallCommand,
	initProject,
} from "./init";
export { type DetectedApp, detectApp, detectPackageManager } from "./init-detect";
export { collectAnswers, type InitAnswerFlags, InitCancelled, type Prompter } from "./init-prompts";
export { type MigrateOptions, migrate } from "./migrate";
export { isPluginCommandName, type PluginCommandRun, runPluginCommand } from "./plugin-command";
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

export interface CliIo {
	readonly cwd: string;
	readonly log: (message: string) => void;
	readonly error: (message: string) => void;
	/** Answers the questions of `monti init` (tests). Default: the terminal, when there is one. */
	readonly prompter?: Prompter;
}

/** Runs the command and returns the exit code. */
export async function runCli(
	argv: readonly string[],
	io: CliIo = { cwd: process.cwd(), log: console.log, error: console.error },
): Promise<number> {
	const [command, ...rest] = argv;
	try {
		// `monti <command> --help` prints that command's section only. (`doctor` answers it itself, and a plugin command has its own.)
		if (command !== undefined && (rest.includes("--help") || rest.includes("-h"))) {
			const section = helpFor(command);
			if (section !== undefined && command !== "doctor") {
				io.log(section);
				return 0;
			}
		}
		if (command === "init") {
			return await runInitCommand(rest, io);
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
		if (command === "doctor") {
			return await runDoctorCommand(rest, io);
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
