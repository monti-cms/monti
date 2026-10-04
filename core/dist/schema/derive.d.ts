import { type ResolvedConfig } from "../config/resolved.js";
import type { CollectionSchema } from "./collection.js";
import { type FieldRole, type SlugField, type StorageType, type TextField, type ValueField } from "./fields.js";
import { type StoredField } from "./walk.js";
export type { StoredField } from "./walk.js";
/**
 * Builds storage, validation and reference rules from a collection definition. Pure functions that know nothing about the DB, HTTP or React.
 * The server (snapshot validation) and the browser (properties panel and form conversion) use the same rules.
 */
declare const SCHEMAS: ResolvedConfig["collections"];
export type SchemaCollection = keyof typeof SCHEMAS & string;
/** Target collection of a relation. `to` and `from` in the definition are strings, and `defineConfig` has checked they are real collections. */
export type RelationTarget = SchemaCollection;
export declare const schemaOf: (collection: SchemaCollection) => CollectionSchema;
/** Stored field list. Follows declaration order, and fields dependent on a conditional field come right after that field. */
export declare function storedFields(collection: SchemaCollection): readonly StoredField[];
export declare function storedField(collection: SchemaCollection, name: string): StoredField | undefined;
export declare function slugFieldOf(collection: SchemaCollection): SlugField | undefined;
/**
 * The stored field with that role (`role`). `undefined` if none. Library and extension code looks up values such as the summary not by field name but
 * with this function.
 */
export declare function roleField(collection: SchemaCollection, role: FieldRole): StoredField | undefined;
/** The value (string) of that role's field. `""` if the field is missing or the value is not a string. */
export declare function roleValue(collection: SchemaCollection, role: FieldRole, values: {
    readonly [key: string]: unknown;
}): string;
/** A field filled from the start of the body when publishing if empty (`fillFromBody`). */
export declare function fillFromBodyFields(collection: SchemaCollection): (StoredField & {
    readonly field: TextField;
})[];
/**
 * Address built from the value that the address field's `from` points to. `""` if `from` is absent or the value is empty (not generated automatically).
 */
export declare function slugFromValues(collection: SchemaCollection, values: {
    readonly [key: string]: unknown;
}): string;
/** Field name → storage format. Same shape as the legacy `COLLECTION_DEFINITIONS.fields`. */
export declare function storageTypes(collection: SchemaCollection): Record<string, StorageType>;
/** List of relation fields. Same shape as the legacy `COLLECTION_DEFINITIONS.relations`. */
export declare function relationsOf(collection: SchemaCollection): {
    field: string;
    kind: "entry";
    to: RelationTarget;
}[];
/**
 * Validates the meaning of values that passed the storage format check. If there is a problem, returns the legacy API's error code.
 */
export declare function fieldValueError(field: ValueField, value: string | readonly string[]): string | null;
export type MetadataReference = {
    /**
     * Relation fields point to content (`entry`) and media fields point to media (`media`). The target collection of the content is decided by the field definition
     * (`relationRule`).
     */
    kind: "entry" | "media";
    targetId: string;
    path: string;
    ordinal?: number;
};
/**
 * Collects references of metadata relation and media fields in declaration order. For multi-value fields, order and duplicates are preserved.
 * Dependent fields whose condition does not match are also collected if they have a value (every stored value is tracked). Media references are used for media usages,
 * filtering "unused", and blocking deletion of files in use.
 */
export declare function metadataReferences(collection: SchemaCollection, metadata: {
    readonly [key: string]: unknown;
}): MetadataReference[];
/** Target collection a relation field expects, and whether unpublished targets are allowed. */
export declare function relationRule(collection: SchemaCollection, path: string): {
    to: RelationTarget;
    allowUnpublished: boolean;
} | undefined;
/** Problems of fields (`required`) that must not be empty when publishing (when saving for item collections). */
export declare function missingRequiredIssues(collection: SchemaCollection, snapshot: {
    slug: string | null;
    metadata: {
        readonly [key: string]: unknown;
    };
}, options?: {
    localizedOnly?: boolean;
}): {
    code: string;
    path: string;
    message?: string;
}[];
/** Names of per-language fields. Unmarked fields are shared by the translation group. */
export declare function localizedFieldNames(collection: SchemaCollection): {
    own: string[];
    inherit: string[];
};
/** Common field keys a translation must not have. Stored fields whose definition has no `localized`. */
export declare function commonFieldKeys(collection: SchemaCollection, metadata: {
    readonly [key: string]: unknown;
}): string[];
/** Picks only the per-language values to carry from the source metadata to the translation. */
export declare function pickLocalizedMetadata<T>(collection: SchemaCollection, metadata: {
    readonly [key: string]: T;
}): Record<string, T>;
/** Public metadata of a translation = common values of the source + per-language values of the translation. */
export declare function mergeTranslationMetadata<T>(collection: SchemaCollection, source: {
    readonly [key: string]: T;
}, translation: {
    readonly [key: string]: T;
}): Record<string, T>;
/**
 * Metadata key that holds the per-language values of item collections (categories, tags, collections). It cannot be used as a field name (`defineConfig`).
 * `{ en: { title: "..." }, ja: { ... } }`. The address and links are shared, so records are not split per language.
 */
export declare const RECORD_TRANSLATIONS_KEY: "translations";
export type RecordTranslations = {
    readonly [locale: string]: {
        readonly [field: string]: string;
    };
};
/** Text fields of an item collection that can have per-language values. */
export declare function recordLocalizedFields(collection: SchemaCollection): string[];
/**
 * Validates and normalizes the per-language values of a record. Accepts only languages other than the default language and the per-language text fields of the definition.
 * Empty values and empty languages are removed. For a bad shape, it returns `error` so the v1 error code can be thrown.
 */
export declare function normalizeRecordTranslations(collection: SchemaCollection, value: unknown, locales: readonly string[]): {
    value: RecordTranslations;
} | {
    error: string;
    path?: string;
    label?: string;
};
