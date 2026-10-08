import type { SchemaMigration } from "../schema-file/types.js";
/**
 * What a schema change is, as data the admin settings screen and the command line both read. A change is one fact about the schema (a field was removed, a select
 * option was renamed, the allowed blocks of a body changed); `diffSchema` lists them, `checkSchemaChange` says which stored entries each one touches, and a
 * transform (`SchemaMigration`) says what happens to the data.
 */
/** The part of a schema the diff reads: the shape of `monti.schema.json` and of the normalized site config (`site.config`). */
export interface SchemaLike {
    readonly collections: Readonly<Record<string, unknown>>;
    readonly locales: readonly {
        readonly code: string;
    }[];
    readonly defaultLocale?: string;
}
/** Where a field sits inside a conditional field: it is shown when the select `field` has `value`. `null` for a field outside any condition. */
export type FieldBranch = {
    readonly field: string;
    readonly value: string;
} | null;
/** What a body of a collection allows (`undefined`: everything of that kind). */
export interface AllowedShape {
    readonly blocks?: readonly string[];
    readonly marks?: readonly string[];
    readonly headings?: readonly number[];
}
/** Every change carries the id of the transform that handles it, when the schema file declares one. */
interface Handled {
    readonly handledBy?: string;
}
export type SchemaChange = ({
    readonly kind: "collection_added";
    readonly collection: string;
} & Handled) | ({
    readonly kind: "collection_removed";
    readonly collection: string;
} & Handled) | ({
    readonly kind: "collection_kind_changed";
    readonly collection: string;
    readonly from: string;
    readonly to: string;
} & Handled) | ({
    /** The collection got a body or lost it. */
    readonly kind: "body_changed";
    readonly collection: string;
    readonly from: boolean;
    readonly to: boolean;
} & Handled) | ({
    /** The blocks, marks or heading levels the body allows changed. `narrowed`: something that was allowed no longer is. */
    readonly kind: "allowed_changed";
    readonly collection: string;
    readonly before: AllowedShape;
    readonly after: AllowedShape;
    readonly narrowed: boolean;
} & Handled) | ({
    readonly kind: "field_added";
    readonly collection: string;
    readonly field: string;
    readonly fieldKind: string;
    readonly required: boolean;
} & Handled) | ({
    readonly kind: "field_removed";
    readonly collection: string;
    readonly field: string;
    readonly fieldKind: string;
} & Handled) | ({
    /** Only found with a `renameField` transform: without one a rename is a removed field and an added one (see `SchemaDiff.renameHints`). */
    readonly kind: "field_renamed";
    readonly collection: string;
    readonly from: string;
    readonly to: string;
} & Handled) | ({
    /** The kind of the field, or what it points to or holds, changed (`text`, `select`, `relation:tag`, `relation:tag[]`, `media:image`). */
    readonly kind: "field_type_changed";
    readonly collection: string;
    readonly field: string;
    readonly from: string;
    readonly to: string;
} & Handled) | ({
    readonly kind: "field_required_changed";
    readonly collection: string;
    readonly field: string;
    readonly required: boolean;
} & Handled) | ({
    /** The field became per-language, inherited, or shared (`shared`, `localized`, `inherit`). */
    readonly kind: "field_locale_changed";
    readonly collection: string;
    readonly field: string;
    readonly from: string;
    readonly to: string;
} & Handled) | ({
    /** The field moved into a conditional branch, out of one, or to another. Stored values do not move: every stored value is kept wherever the field is. */
    readonly kind: "field_moved";
    readonly collection: string;
    readonly field: string;
    readonly from: FieldBranch;
    readonly to: FieldBranch;
} & Handled) | ({
    readonly kind: "option_added";
    readonly collection: string;
    readonly field: string;
    readonly option: string;
} & Handled) | ({
    readonly kind: "option_removed";
    readonly collection: string;
    readonly field: string;
    readonly option: string;
} & Handled) | ({
    /** Only found with a `mapOption` transform to an option that is new: the stored value `from` becomes `to`. */
    readonly kind: "option_renamed";
    readonly collection: string;
    readonly field: string;
    readonly from: string;
    readonly to: string;
} & Handled) | ({
    readonly kind: "locale_added";
    readonly locale: string;
} & Handled) | ({
    readonly kind: "locale_removed";
    readonly locale: string;
} & Handled) | ({
    readonly kind: "default_locale_changed";
    readonly from: string;
    readonly to: string;
} & Handled);
export type SchemaChangeKind = SchemaChange["kind"];
/** A removed and an added thing that look like one renamed thing (same kind of field, same options; same fields for a collection). A hint for a transform, never applied by itself. */
export interface RenameHint {
    readonly scope: "collection" | "field";
    readonly collection?: string;
    readonly from: string;
    readonly to: string;
}
export interface SchemaDiff {
    readonly changes: readonly SchemaChange[];
    readonly renameHints: readonly RenameHint[];
}
export interface DiffOptions {
    /**
     * The transforms of the change (the pending ones of the schema file). They tell a rename from a removal plus an addition (`renameField`, `mapOption`), and mark
     * the changes they handle (`handledBy`).
     */
    readonly transforms?: readonly SchemaMigration[];
}
/** A stable name of a change, for a list in a screen: the same change in two diffs has the same key. */
export declare function changeKey(change: SchemaChange): string;
export {};
