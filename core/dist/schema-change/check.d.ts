import type { SchemaChangeStore } from "../core/store/ports.js";
import type { ScannedBody } from "../core/store/schema-change.js";
import type { SchemaMigration } from "../schema-file/types.js";
import type { Site } from "../site/index.js";
import { type SchemaChange, type SchemaDiff } from "./types.js";
/**
 * What a schema change does to the entries that are stored. `checkSchemaChange` reads the stored bodies and says, per change, which entries it touches (a count and a
 * few of them) and what happens to them. It changes nothing.
 */
/** What happens to the entries a change touches, if the change is applied as it is. */
export type ImpactConsequence = 
/** Nothing in the stored data follows from the change. */
"none"
/** A transform of the schema file rewrites the stored values. */
 | "transformed"
/** A `dropField` transform deletes the stored values. */
 | "deleted"
/** The stored values stay as orphans: kept in the entry, hidden from the public read, listed in a warning at publish. */
 | "orphaned"
/** A select value that is no longer an option stays as stored; publishing warns (`unknown_select_value`). */
 | "unknown_value"
/** The entries have no value for a required field: they cannot be published (items: saved) until it is filled. */
 | "publish_blocked"
/** The body holds blocks, marks or headings the new list does not allow; they are kept and every save and publish warns. */
 | "warned"
/** The stored values do not fit the field's new type; saving the entry may be rejected until they are fixed. */
 | "invalid_values"
/** The data is kept as it is; the screen shows it differently. */
 | "kept";
export interface ImpactSample {
    readonly id: string;
    /** The value of the entry's title field, or `null` (also when the check was not given a site, which knows the title field). */
    readonly title: string | null;
    readonly collection: string;
    readonly locale: string;
    readonly status: string;
}
export interface ChangeImpact {
    readonly change: SchemaChange;
    /** `changeKey(change)`. */
    readonly key: string;
    /** Entries touched. An entry counts once, whether its working copy, its published copy or both are touched. */
    readonly entries: number;
    /** The first entries touched (by id), up to `sampleSize`. */
    readonly sample: readonly ImpactSample[];
    readonly consequence: ImpactConsequence;
    /** `false` when the change was not looked at in the data (an allowed-blocks change needs the `site` option); `entries` is then 0. */
    readonly checked: boolean;
}
export interface SchemaImpact {
    readonly impacts: readonly ChangeImpact[];
    /** Stored bodies read to answer. */
    readonly bodiesRead: number;
}
export interface CheckOptions {
    /** How many entries to list per change. Default 5. */
    readonly sampleSize?: number;
    /**
     * The site of the new schema. Needed for what only the new rules can tell: whether a body holds blocks the new list does not allow, and which fields sit in a
     * conditional branch when checking required values. Without it an allowed-blocks change is not checked (`checked: false`).
     */
    readonly site?: Pick<Site, "storedField" | "titleField" | "isCollection" | "BLOCKS" | "ADDED_BLOCKS" | "BLOCK_BY_NAME">;
    /** The transforms of the change, so a handled change reports what the transform does (`transformed`, `deleted`). */
    readonly transforms?: readonly SchemaMigration[];
    /** Bodies per read. */
    readonly batchSize?: number;
}
/** Walks every page of `store.scanBodies`, yielding one page at a time. */
export declare function scanAllBodies(store: Pick<SchemaChangeStore, "scanBodies">, params?: {
    collections?: readonly string[];
    limit?: number;
}): AsyncGenerator<readonly ScannedBody[]>;
/**
 * Reports which stored entries each change of a diff touches. Read-only: it scans the stored bodies once (`store.scanBodies`) and answers every change from that scan.
 *
 * - `entries` counts entries (an entry counts once even if its draft and its published copy are both touched); `sample` lists the first ones with their title.
 * - `consequence` says what happens to them if the change is applied as it is: kept as orphans, transformed by a transform of the schema file, deleted by a
 *   `dropField`, blocked from publishing until filled, and so on. Nothing is dropped without a `dropField`.
 * - A change that touches nothing in the data (a collection or option added) reports 0.
 */
export declare function checkSchemaChange(store: Pick<SchemaChangeStore, "scanBodies">, diff: SchemaDiff, options?: CheckOptions): Promise<SchemaImpact>;
