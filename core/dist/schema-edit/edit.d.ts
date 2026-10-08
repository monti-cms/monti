import type { Cms } from "../cms/index.js";
import { type BodyVocabulary } from "../schema/allowed.js";
import { type ChangeImpact, type ImpactSample, type SchemaChange, SchemaChangeError, type SuggestedTransform, type TransformProblem } from "../schema-change/index.js";
import { type SchemaIssue } from "../schema-file/format.js";
import type { SchemaMigration } from "../schema-file/types.js";
export declare const hashOf: (text: string) => string;
/** The schema file as the screen shows it. */
export interface SchemaScreenState {
    readonly access: {
        readonly writable: boolean;
        readonly reason?: string;
    };
    /** The path of the schema file relative to the working directory (what the screen calls the file), or `null` when there is none. */
    readonly file: string | null;
    /** Hash of the file's text: a save names the hash it was edited from, and is refused when the file changed since. `null` without a file. */
    readonly hash: string | null;
    /** The file's content, or (without a file) the schema the instance runs. */
    readonly schema: unknown;
    readonly source: "file" | "site";
    /** The file is on disk but does not check: what is wrong with it, with JSON paths. The screen shows these instead of editing. */
    readonly issues: readonly SchemaIssue[];
    /** The version the instance runs. */
    readonly schemaVersion: number;
    /** The schema last applied to the dev database, or `null` when none was (or the store has no schema record yet). */
    readonly applied: {
        readonly schemaVersion: number;
        readonly appliedAt: string;
    } | null;
    /** Collections the config adds in code: not in the file, so the screen cannot edit them. */
    readonly codeCollections: readonly string[];
    /** The block and mark names a body list can name. */
    readonly vocabulary: BodyVocabulary;
    /** The admin path, for links to entries. */
    readonly collections: readonly string[];
}
/** What `GET /v1/schema` answers: the file, its hash, and the facts the screen needs (see {@link SchemaScreenState}). */
export declare function readSchemaScreen(cms: Cms): Promise<SchemaScreenState>;
/** What the writer says about a change the diff cannot tell: that a field or an option was renamed (the screen knows, it did the rename). */
export type RenameInput = {
    readonly kind: "field";
    readonly collection: string;
    readonly from: string;
    readonly to: string;
} | {
    readonly kind: "option";
    readonly collection: string;
    readonly field: string;
    readonly from: string;
    readonly to: string;
};
/** What the screen sends to check or save an edit. */
export interface SchemaEditInput {
    /** The schema file's content as edited. `migrations` and `schemaVersion` are the file's own; the save appends the chosen transforms and raises the version. */
    readonly schema: unknown;
    /**
     * The transforms the writer picked (without ids; the server names them). Left out: the defaults of {@link decisionsOf} (a rename when the screen did one,
     * else a mapping or a drop only where no stored entry holds the value).
     */
    readonly transforms?: readonly SuggestedTransform[];
    /** Renames the screen made, so a rename is offered as a rename and not as a removal. */
    readonly renames?: readonly RenameInput[];
}
/** A change that has more than one thing the data can do about it: the writer picks. */
export interface SchemaDecision {
    readonly key: string;
    readonly change: SchemaChange;
    /** Entries the change touches if no transform handles it, and a few of them. */
    readonly entries: number;
    readonly sample: readonly ImpactSample[];
    /** What the writer can pick, the first being the one the server would pick. An empty pick (no transform) is always possible and not listed. */
    readonly suggestions: readonly SuggestedTransform[];
    /** The pick in effect: the one the screen sent, or the default. `null`: no transform. */
    readonly chosen: SuggestedTransform | null;
}
export interface SchemaEditPreview {
    /** The edit checks. When it does not, `issues` says what is wrong, with JSON paths, and the rest is empty. */
    readonly valid: boolean;
    readonly issues: readonly SchemaIssue[];
    /** Something would be written or applied: the content differs from the file, or a change or transform is pending. */
    readonly changed: boolean;
    /** The schema changes the stored data cares about (collections, fields, options, locales, allowed blocks), each with the entries it touches. */
    readonly impacts: readonly ChangeImpact[];
    readonly decisions: readonly SchemaDecision[];
    /** The transforms in effect, in the order they would be appended to `migrations` (with the ids the save would give them). */
    readonly transforms: readonly SchemaMigration[];
    /** Problems that stop the save (a transform that does not fit the schema). */
    readonly problems: readonly TransformProblem[];
    /** The version the save would record. */
    readonly nextVersion: number;
    readonly currentVersion: number;
    /** The schema applied to the dev database is older than the file (the file was changed by hand and not applied): the diff includes that. */
    readonly baseline: "applied" | "file";
    readonly bodiesRead: number;
}
/**
 * Checks an edit without writing anything: the diff against the schema last applied to the dev database (or against the running schema when none was applied),
 * the entries each change touches, the changes that need a pick of a data transform, and the problems of the picks. Needs the same access as a save.
 */
export declare function previewSchemaEdit(cms: Cms, input: SchemaEditInput): Promise<SchemaEditPreview>;
export interface SchemaSaveInput extends SchemaEditInput {
    /** The hash of the file the edit started from (`SchemaScreenState.hash`). A different one means the file changed meanwhile. */
    readonly baseHash: string;
}
export type SchemaSaveResult = {
    readonly saved: false;
    readonly reason: "invalid";
    readonly issues: readonly SchemaIssue[];
} | {
    readonly saved: false;
    readonly reason: "problems";
    readonly problems: readonly TransformProblem[];
} | {
    readonly saved: false;
    readonly reason: "conflict";
} | {
    readonly saved: false;
    readonly reason: "unchanged";
} | {
    readonly saved: true;
    readonly file: string;
    readonly hash: string;
    readonly schemaVersion: number;
    /** The transforms appended to `migrations` and run. */
    readonly transforms: readonly SchemaMigration[];
    /** Entries the apply rewrote. */
    readonly entriesRewritten: number;
    readonly types: {
        readonly file: string;
        readonly changed: boolean;
    };
    /** The running instance now runs the new schema. */
    readonly reloaded: boolean;
    /** Entries where a rename found a value under the new name already: both were kept. */
    readonly conflicts: number;
} | {
    /** The file was written but the apply failed: nothing in the database changed; `monti schema:apply` runs it again. */
    readonly saved: false;
    readonly reason: "apply_failed";
    readonly message: string;
    readonly file: string;
    readonly hash: string;
};
/**
 * Saves an edit, in this order, stopping at the first failure:
 *
 * 1. Checks the edit (format, then the rules between collections) and the transforms; refuses a file that changed since the edit started (`baseHash`).
 * 2. Dry-runs the transforms on the dev database (nothing written) so an entry that cannot be rewritten stops the save before the file is touched.
 * 3. Writes `monti.schema.json` with the chosen transforms appended to `migrations` and `schemaVersion` raised, keeping the file's formatting and key order.
 * 4. Writes the generated types (`monti-env.d.ts`).
 * 5. Runs `applySchemaChange` against the dev database (creating the tables first when the store has none) with the schema as written.
 * 6. Reloads the running instance from the file (`cms.reloadSchema()`).
 *
 * The caller has checked `schemaEditAccess`.
 */
export declare function saveSchemaEdit(cms: Cms, input: SchemaSaveInput): Promise<SchemaSaveResult>;
export { SchemaChangeError };
export type { SchemaIssue };
