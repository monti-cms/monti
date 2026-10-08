import type { SchemaMigration } from "../schema-file/types.js";
import type { Site } from "../site/index.js";
import type { SchemaChange } from "./types.js";
/**
 * The data transforms of a schema change (`SchemaMigration`, listed in `migrations` of the schema file). Each is a pure function of one entry's stored
 * metadata; the store runs them over every stored body in one transaction (`applySchemaChange`).
 *
 * - `renameField`: the value moves to the new name. Nothing is overwritten: an entry that already has a value under the new name keeps both and is reported.
 * - `mapOption`: a stored select value that is no longer an option becomes another option (also inside a list of values, without duplicates).
 * - `dropField`: the only transform that deletes data, and only the values of a field the schema no longer has.
 * - `setDefault`: an entry with no value gets one (the field must be text or select). A translation only gets it for a per-language field.
 *
 * Moving a field into or out of a conditional branch needs no transform: a stored value is kept wherever its field is, so nothing moves in the data.
 */
/** A problem that stops a transform from running. */
export interface TransformProblem {
    readonly id: string;
    readonly message: string;
}
/** The part of a site the transforms read. */
type TransformSite = Pick<Site, "isCollection" | "storedField">;
/**
 * Checks transforms against the schema they run under (`site`: the schema after the change). A transform that would be wrong is a problem, so it never runs:
 * a field that is not there to rename to, a `dropField` of a field the schema still has (it would delete live data), a `mapOption` to something that is not an
 * option, a default that is not valid for its field.
 */
export declare function checkTransforms(site: TransformSite, transforms: readonly SchemaMigration[]): TransformProblem[];
/** What running the transforms on one body gave. */
export interface TransformResult {
    readonly metadata: Record<string, unknown>;
    /** Ids of the transforms that changed the metadata. */
    readonly changedBy: readonly string[];
    /** Entries where a rename found a value under the new name already: both were kept. */
    readonly conflicts: readonly {
        readonly id: string;
        readonly from: string;
        readonly to: string;
    }[];
}
/** Which collections a list of transforms touches. */
export declare const transformCollections: (transforms: readonly SchemaMigration[]) => string[];
/**
 * Runs the transforms (in order) on the metadata of one stored body of `collection`. The input is not changed. `isTranslation`: the body belongs to a
 * translation, which holds only per-language values.
 */
export declare function applyTransforms(site: TransformSite, transforms: readonly SchemaMigration[], body: {
    readonly collection: string;
    readonly isTranslation?: boolean;
}, metadata: {
    readonly [key: string]: unknown;
}): TransformResult;
/** A transform that fits a change, without its id (the caller names it). */
export type SuggestedTransform = DistributiveOmit<SchemaMigration, "id" | "note">;
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/**
 * The transforms that fit a change, for a screen to offer. A removed field offers a drop (and a rename to each field that looks like it was renamed, see
 * `SchemaDiff.renameHints`, when `renameTo` lists candidates); a removed option offers a mapping to each option that is left; a field that became required
 * offers a default. Nothing is offered for a change data does not follow from.
 */
export declare function suggestTransforms(change: SchemaChange, context?: {
    readonly options?: readonly string[];
    readonly renameTo?: readonly string[];
}): SuggestedTransform[];
export {};
