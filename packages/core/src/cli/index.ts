/**
 * The `monti` command line (package `bin`). `bin/monti.mjs` registers tsx and then calls `runCli`. The commands are listed in `commands.ts` (the help is generated from the
 * same table, see `monti --help`); the runner is `run.ts`.
 */

export { findSchemaFile, loadSchemaFile, SCHEMA_FILE_CANDIDATES } from "../schema-file/locate";
export { adminResetPassword, type ResetPasswordOptions } from "./admin-command";
export type { CliContext, CliIo } from "./command";
export { dbMigrate, dbSetup, type MigrateOptions } from "./db";
export { unifiedDiff } from "./diff";
export {
	type DoctorOptions,
	type DoctorReport,
	type DoctorResult,
	type DoctorSummary,
	formatDoctorReport,
	runDoctor,
} from "./doctor";
export { DEFAULT_ENV_FILES, loadEnvFiles } from "./env";
export { type EventsRetryOptions, eventsRetry } from "./events";

export { initProject } from "./init";
export { type DetectedApp, detectApp, detectPackageManager } from "./init-detect";
export { collectAnswers, type InitAnswerFlags } from "./init-prompts";
export { formatInitReport } from "./init-report";
export type { InitHost, InitOptions, InitReport, InstallCommand } from "./init-types";
export { InitError } from "./init-writer";
export { parseJsonc } from "./jsonc";
export {
	CONFIG_CANDIDATES,
	EXTRACT_CONFIG_CANDIDATES,
	locateConfig,
	locateExtractConfig,
	locateSchema,
} from "./locate";
export { isPluginCommandName, runPluginCommand } from "./plugin-command";
export { Cancelled, createClackPrompter, type Prompter } from "./prompt";
export { runCli } from "./run";
export {
	formatApplyResult,
	formatSchemaPlan,
	type SchemaApplyOutcome,
	type SchemaCommandOptions,
	type SchemaDiffResult,
	schemaApply,
	schemaDiff,
} from "./schema-apply";
export {
	type ExtractedSchema,
	type ExtractOptions,
	type ExtractReport,
	extractSchema,
	extractSchemaData,
	formatExtractReport,
	type StaysInCode,
	schemaFileText,
} from "./schema-extract";
