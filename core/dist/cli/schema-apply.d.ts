import type { Cms } from "../cms/index.js";
import { type SchemaApplyResult, type SchemaImpact, type SchemaPlan } from "../schema-change/index.js";
import { type AppOptions } from "./app.js";
export interface SchemaCommandOptions extends AppOptions {
    /** Schema file (relative to `cwd`). Default: `monti.schema.json`, then `src/monti.schema.json`. */
    readonly schema?: string;
    /** Loads the CMS instance (default: the server file of the app, see `loadApp`). Tests pass their own. */
    readonly loadCms?: (options: AppOptions) => Promise<Cms>;
}
/** The text `schema:diff` and `schema:apply` print for a plan and its impact. */
export declare function formatSchemaPlan(plan: SchemaPlan, impact: SchemaImpact): string;
/** The text for a finished (or dry) apply. */
export declare function formatApplyResult(done: SchemaApplyResult, wroteVersion: boolean, schemaFile: string): string;
/**
 * Sets `schemaVersion` in the text of a schema file without reformatting it: the existing number is replaced; a file without one gets the line after `$schema` (or
 * first). Works on the text so the file's own formatting stays.
 */
export declare function withSchemaVersion(text: string, version: number): string;
export interface SchemaDiffResult {
    readonly text: string;
    readonly plan: SchemaPlan;
    readonly impact: SchemaImpact;
    /** Exit code: 0, or 1 with `check` when there is something to apply, or when a transform does not fit. */
    readonly exitCode: number;
}
/**
 * `monti schema:diff`: compares the schema of the site with the one last applied to the store (the snapshot `schema:apply` recorded), and says which stored entries
 * each change touches. Read-only. With `check`, exits 1 when there is anything to apply.
 */
export declare function schemaDiff(options: SchemaCommandOptions & {
    readonly check?: boolean;
}): Promise<SchemaDiffResult>;
export interface SchemaApplyOutcome {
    readonly text: string;
    readonly ok: boolean;
    readonly done?: SchemaApplyResult;
}
/**
 * `monti schema:apply [--dry-run]`: migrates the store, runs the transforms of the schema file that did not run yet (`migrations`), and records the schema and its
 * version. It raises `schemaVersion` in the schema file when the schema changed and the file still has the old one (commit the file). Running it again does
 * nothing more. `dryRun` does everything inside a transaction that is rolled back, and writes nothing, not even the file.
 */
export declare function schemaApply(options: SchemaCommandOptions & {
    readonly dryRun?: boolean;
}): Promise<SchemaApplyOutcome>;
