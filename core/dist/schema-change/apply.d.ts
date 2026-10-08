import type { SchemaChangeStore } from "../core/store/ports.js";
import type { AppliedSchemaChange, SchemaState } from "../core/store/schema-change.js";
import type { JsonObject } from "../core/store/types.js";
import type { SchemaMigration } from "../schema-file/types.js";
import type { Site } from "../site/index.js";
import { type TransformProblem } from "./transforms.js";
import type { SchemaDiff } from "./types.js";
/**
 * Planning and applying a schema change: `planSchemaChange` is read-only and says what `applySchemaChange` would do; `applySchemaChange` runs the pending
 * transforms and records the schema and its version. The command line (`monti schema:diff`, `monti schema:apply`) and the settings screen are both thin
 * layers over these.
 *
 * The old side of a diff is the schema last applied to the store (`SchemaChangeStore.readSchemaState`), the new side is the site's. A store that never applied
 * one is at its baseline: nothing differs, the first apply records the schema and the version without touching an entry (so a site that extracted its
 * schema file (`monti schema:extract`) and applies it with no transforms changes nothing).
 */
/** The data model of a site as JSON: what is recorded as "applied" and what the next diff reads as the old side. */
export declare function snapshotSchema(site: Pick<Site, "config">): JsonObject;
export interface PlanOptions {
    /** The site of the new schema (its config is the schema after the change). */
    readonly site: Site;
    readonly store: Pick<SchemaChangeStore, "readSchemaState" | "appliedSchemaTransforms">;
    /** The transforms of the schema file (`migrations`), applied ones included. */
    readonly migrations?: readonly SchemaMigration[];
}
export interface SchemaPlan {
    /** The schema last applied, or `null`: the store is at its baseline and the apply records it. */
    readonly applied: SchemaState | null;
    readonly diff: SchemaDiff;
    /** The transforms that did not run yet, in order. */
    readonly pending: readonly SchemaMigration[];
    /** Ids of the transforms that ran before. */
    readonly alreadyApplied: readonly string[];
    /** Problems that stop the apply (a transform that does not fit the schema). */
    readonly problems: readonly TransformProblem[];
    /**
     * The version the apply records and stamps on the entries it transforms: the schema file's version, or one above the applied version when the schema
     * changed (or transforms are pending) and the file still has the old one.
     */
    readonly nextVersion: number;
    /** The schema file's version is not enough: the apply raises it (the command writes the file). */
    readonly needsVersionBump: boolean;
    /** The schema changed or transforms are pending: an apply would do something besides recording the schema. */
    readonly changed: boolean;
}
/** The version of the schema of a site: its `schemaVersion`, 1 if unset. */
export declare const schemaVersionOf: (site: Pick<Site, "config">) => number;
/**
 * Compares the site's schema with the one last applied, and finds the transforms still to run. Read-only.
 *
 * Versions: `nextVersion` is the file's version, raised to one above the applied version when something changes. A schema file that was already raised (by
 * `schema:apply` on a development machine, then committed) is left alone, so the production run records the same version and writes nothing to the file.
 */
export declare function planSchemaChange(options: PlanOptions): Promise<SchemaPlan>;
/** The transforms cannot run: a transform does not fit the schema, or an entry cannot be rewritten. Nothing was changed. */
export declare class SchemaChangeError extends Error {
    readonly problems: readonly TransformProblem[];
    constructor(message: string, problems?: readonly TransformProblem[]);
}
export interface ApplyOptions extends Omit<PlanOptions, "store"> {
    readonly store: Pick<SchemaChangeStore, "readSchemaState" | "appliedSchemaTransforms" | "applySchemaChange">;
    /** Do everything and report, but change nothing. */
    readonly dryRun?: boolean;
    /** The version to record, when the caller raised it (the command writes it to the schema file). Default: the plan's `nextVersion`. */
    readonly schemaVersion?: number;
}
export interface SchemaApplyResult {
    readonly plan: SchemaPlan;
    /** What the store did: which transforms ran, how many entries and bodies they changed. */
    readonly result: AppliedSchemaChange;
    /** The version recorded and stamped. */
    readonly schemaVersion: number;
    /** Entries where a rename found a value under the new name already: both values were kept, and nothing was overwritten. */
    readonly conflicts: readonly {
        readonly id: string;
        readonly entryId: string;
        readonly from: string;
        readonly to: string;
    }[];
}
/**
 * Applies the schema: runs the transforms that did not run yet, and records the schema and its version. Idempotent: each transform is recorded in
 * `cms_migrations` (like `storage.once`), so a second run runs none of them, and with the schema unchanged it only records the same schema again.
 *
 * Every transform goes through the write rules (`prepareSnapshot`, with no write hooks): the changed metadata is checked, and the content hash, the search text and
 * the metadata references are recomputed from it, so they cannot drift from the data. Working and published bodies are rewritten the same way and `version` and
 * `updated_at` of the entry and its bodies are kept, as in the data migrations before, so an entry that had unpublished changes still has them and one that did
 * not still does not. A transformed body is stamped with the new schema version. Nothing is dropped without a `dropField` transform.
 *
 * Throws a {@link SchemaChangeError} (changing nothing) when a transform does not fit the schema or an entry cannot be rewritten.
 */
export declare function applySchemaChange(options: ApplyOptions): Promise<SchemaApplyResult>;
