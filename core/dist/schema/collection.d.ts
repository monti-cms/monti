import type { BacklinkField, Field, SlugField, ValueField, ValueOf } from "./fields.js";
/**
 * Collection kind.
 *
 * - `document`: you write a body and it is split into a draft and a published version. It goes public with an explicit publish (e.g. posts).
 * - `item`: saving in a small form applies straight to the current (public) value. There is no publish, archive or translation copy (e.g. tags).
 */
export type CollectionKind = "document" | "item";
/**
 * Legacy name (`workflow`). `publish` is `document` and `record` is `item`.
 * @deprecated Use `kind`. `defineCollection` still accepts it and converts it to `kind`.
 */
export type CollectionWorkflow = "publish" | "record";
/** Kind in the legacy name (`workflow`). */
export type KindOfWorkflow<W extends CollectionWorkflow> = W extends "record" ? "item" : "document";
/** Converts the legacy name (`workflow`) into the kind (`kind`). */
export declare const kindOfWorkflow: (workflow: CollectionWorkflow) => CollectionKind;
/** System columns of the list. They are values of the content itself, not fields. */
export declare const SYSTEM_LIST_COLUMNS: readonly ["status", "locale", "updatedAt", "createdAt", "publishedAt", "folder"];
export type SystemListColumn = (typeof SYSTEM_LIST_COLUMNS)[number];
/**
 * Checks whether a name can be used by the list columns (`list.columns`). Only system columns, stored field names (including fields dependent on a conditional field),
 * address field names, and `slug` when an address field exists are allowed. It is an error if the name is unknown, the field is not stored (view or reverse relation),
 * or the same name is written twice. Called by `defineConfig`.
 */
export declare function validateListColumns(collection: string, schema: Pick<CollectionSchema, "fields"> & {
    readonly list?: {
        readonly columns: readonly string[];
    };
}): void;
export interface LayoutGroup<Name extends string = string> {
    /** Group title in the properties panel. If absent, it is drawn continuously without a title. */
    readonly group?: string;
    readonly fields: readonly Name[];
    /** Collapsed at first. */
    readonly collapsed?: boolean;
    /**
     * Tab name in which this group is drawn in the edit screen's properties area. Groups with the same name gather in one tab; if absent, it is drawn in the default tab (`속성`).
     */
    readonly tab?: string;
}
export interface CollectionSchema<Fields extends Readonly<Record<string, Field>> = Readonly<Record<string, Field>>, Kind extends CollectionKind = CollectionKind> {
    readonly label: string;
    /** Collection kind (`document`, `item`). */
    readonly kind: Kind;
    /** Whether it has a body (MDX). If absent, only `document` collections have a body. */
    readonly body: boolean;
    /**
     * Field name → definition. A `title` text field (`fields.text`) is required (`defineConfig` checks it). The list, search,
     * relation picker, body links and the edit screen's title box use this field.
     */
    readonly fields: Fields;
    /**
     * Public address shape (e.g. `/posts/:slug`). `:slug` must appear exactly once. Used to recognize internal links in the body (pre-publish check) and
     * when the editor creates links. If absent, this collection cannot be pointed to by body links.
     */
    readonly path?: string;
    /**
     * Admin sidebar icon name (lucide, e.g. `file-text`, `notebook-pen`, `tag`, `shapes`, `layers`, `folder`, `image`).
     * If absent or unknown, it is the default icon for the kind.
     */
    readonly icon?: string;
    /**
     * Properties panel layout. Fields not listed are drawn after the last group in declaration order. If absent, they are drawn in field declaration order,
     * and fields that have their own `tab` gather in that tab.
     */
    readonly layout?: readonly LayoutGroup[];
    /**
     * List. If absent, the default columns: for documents, title, status, language (when there are two or more languages), category field (a relation pointing to an item collection),
     * modified date and published date; for items, title, address, language, status and modified date.
     */
    readonly list?: {
        /**
         * Columns the list shows and their order. Field names or system columns. Unknown names are reported as errors by `defineConfig`.
         * Text (`text`), select (`select`) and relation fields are drawn as default cells, and an admin extension (`listCells`) can change the cell look.
         */
        readonly columns: readonly string[];
    };
}
/** Value `defineCollection` accepts (without the kind). Types check that names in layout and list columns are real fields. */
type CollectionInput<Fields extends Readonly<Record<string, Field>>> = Omit<CollectionSchema<Fields>, "kind" | "body" | "layout" | "list" | "path"> & {
    path?: `/${string}:slug${string}`;
    body?: boolean;
    layout?: readonly LayoutGroup<Extract<keyof Fields, string>>[];
    list?: {
        columns: readonly (Extract<keyof Fields, string> | SystemListColumn)[];
    };
};
/** Defines a collection. Types check that names in layout and list columns are real fields. */
export declare function defineCollection<const Fields extends Readonly<Record<string, Field>>, const Kind extends CollectionKind>(schema: CollectionInput<Fields> & {
    kind: Kind;
    workflow?: undefined;
}): CollectionSchema<Fields, Kind>;
/** @deprecated Use `kind` instead of `workflow` (`publish` → `document`, `record` → `item`). */
export declare function defineCollection<const Fields extends Readonly<Record<string, Field>>, const Workflow extends CollectionWorkflow>(schema: CollectionInput<Fields> & {
    workflow: Workflow;
    kind?: undefined;
}): CollectionSchema<Fields, KindOfWorkflow<Workflow>>;
/**
 * Normalizes a collection definition: converts the legacy name (`workflow`) into the kind (`kind`) and fills the body default (only `document` has a body).
 * Called by `defineCollection` and `defineConfig` (an already normalized definition stays as is).
 */
export declare function normalizeCollection(schema: Omit<CollectionSchema, "kind" | "body"> & {
    readonly kind?: CollectionKind;
    readonly workflow?: CollectionWorkflow;
    readonly body?: boolean;
}): CollectionSchema;
type Stored<Fields> = {
    [K in keyof Fields as Fields[K] extends SlugField | BacklinkField ? never : K]: Fields[K];
};
/** Flattens fields dependent on a conditional field to the top level (same as the storage format). */
type Nested<Fields> = {
    [K in keyof Fields]: Fields[K] extends {
        readonly kind: "conditional";
        readonly values: infer V;
    } ? V[keyof V] extends infer Group ? Group extends Readonly<Record<string, ValueField>> ? Group : never : never : never;
}[keyof Fields];
type UnionToIntersection<U> = (U extends unknown ? (value: U) => void : never) extends (value: infer I) => void ? I : never;
type FieldValue<F> = F extends {
    readonly kind: "conditional";
    readonly discriminant: infer D;
} ? ValueOf<D> : ValueOf<F>;
/**
 * Metadata type built from a collection definition. A draft may be empty, so every key is optional.
 */
export type MetadataOf<S extends CollectionSchema> = {
    -readonly [K in keyof Stored<S["fields"]>]?: FieldValue<S["fields"][K]>;
} & {
    -readonly [K in keyof UnionToIntersection<Nested<S["fields"]>>]?: ValueOf<UnionToIntersection<Nested<S["fields"]>>[K]>;
};
export {};
