import type { Prompter } from "./init-prompts.js";
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
export { CONFIG_CANDIDATES, parseJsonc, resolveConfigPath } from "./config-paths.js";
export { unifiedDiff } from "./diff.js";
export { DOCTOR_HELP, type DoctorCommandIo, type DoctorOptions, type DoctorReport, type DoctorResult, type DoctorSummary, formatDoctorReport, runDoctor, runDoctorCommand, } from "./doctor/index.js";
export { DEFAULT_ENV_FILES, loadEnvFiles } from "./env.js";
export { type EventsRetryOptions, eventsRetry } from "./events.js";
export { type BoundaryViolation, findBoundaryViolations, formatBoundaryViolations, SERVER_ONLY_MODULES, } from "./import-boundary.js";
export { formatInitReport, InitError, type InitHost, type InitOptions, type InitReport, type InstallCommand, initProject, } from "./init.js";
export { type DetectedApp, detectApp, detectPackageManager } from "./init-detect.js";
export { collectAnswers, type InitAnswerFlags, InitCancelled, type Prompter } from "./init-prompts.js";
export { type MigrateOptions, migrate } from "./migrate.js";
export { isPluginCommandName, type PluginCommandRun, runPluginCommand } from "./plugin-command.js";
export { formatApplyResult, formatSchemaPlan, type SchemaApplyOutcome, type SchemaCommandOptions, type SchemaDiffResult, schemaApply, schemaDiff, withSchemaVersion, } from "./schema-apply.js";
export { CONFIG_FILE_CANDIDATES, type ExtractedSchema, type ExtractOptions, type ExtractReport, extractSchema, extractSchemaData, formatExtractReport, type StaysInCode, schemaFileText, } from "./schema-extract.js";
export { findSchemaFile, generateSchemaTypes, SCHEMA_FILE_CANDIDATES, SCHEMA_LINK, SCHEMA_TYPES_FILE, type SchemaTypesOptions, type SchemaTypesResult, schemaTypesText, toTypeLiteral, watchSchemaTypes, } from "./schema-types.js";
export interface CliIo {
    readonly cwd: string;
    readonly log: (message: string) => void;
    readonly error: (message: string) => void;
    /** Answers the questions of `monti init` (tests). Default: the terminal, when there is one. */
    readonly prompter?: Prompter;
}
/** Runs the command and returns the exit code. */
export declare function runCli(argv: readonly string[], io?: CliIo): Promise<number>;
