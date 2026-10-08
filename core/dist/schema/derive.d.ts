import type { CollectionsConfig } from "../config/define.js";
import type { CollectionSchema } from "./collection.js";
import { type FieldRole, type SlugField, type StorageType, type TextField, type ValueField } from "./fields.js";
import { type StoredField, type TitleField } from "./walk.js";
export type { StoredField } from "./walk.js";
/**
 * Builds storage, validation and reference rules from a collection definition. Pure functions that know nothing about the DB, HTTP or React.
 * The server (snapshot validation) and the browser (properties panel and form conversion) use the same rules.
 *
 * The functions that look a collection up by name belong to one site's collections: `createSchemas(config.collections)` returns them, and a `Site` carries them.
 */
/** Collection names (keys of `collections` in the site config). Follows declaration order. */
export type SchemaCollection = string;
/** Target collection of a relation. `to` and `from` in the definition are strings, and `defineSite` has checked they are real collections. */
export type RelationTarget = SchemaCollection;
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
 * Metadata key that holds the per-language values of item collections (categories, tags, collections). It cannot be used as a field name (`defineSite`).
 * `{ en: { title: "..." }, ja: { ... } }`. The address and links are shared, so records are not split per language.
 */
export declare const RECORD_TRANSLATIONS_KEY: "translations";
export type RecordTranslations = {
    readonly [locale: string]: {
        readonly [field: string]: string;
    };
};
/** The storage, validation and reference rules of one site's collections. */
export type SiteSchemas = ReturnType<typeof createSchemas>;
/** The rules of the collections of one site config (`config.collections`). */
export declare function createSchemas(collections: CollectionsConfig): {
    schemaOf: (collection: SchemaCollection) => CollectionSchema;
    storedFields: (collection: SchemaCollection) => readonly StoredField[];
    storedField: (collection: SchemaCollection, name: string) => StoredField | undefined;
    slugFieldOf: (collection: SchemaCollection) => SlugField | undefined;
    roleField: (collection: SchemaCollection, role: FieldRole) => StoredField | undefined;
    roleValue: (collection: SchemaCollection, role: FieldRole, values: {
        readonly [key: string]: unknown;
    }) => string;
    titleField: (collection: SchemaCollection) => TitleField;
    titleOfValues: (collection: SchemaCollection, values: {
        readonly [key: string]: unknown;
    }) => string | null;
    fillFromBodyFields: (collection: SchemaCollection) => (StoredField & {
        readonly field: TextField;
    })[];
    slugFromValues: (collection: SchemaCollection, values: {
        readonly [key: string]: unknown;
    }) => string;
    storageTypes: (collection: SchemaCollection) => Record<string, StorageType>;
    relationsOf: (collection: SchemaCollection) => {
        field: string;
        kind: "entry";
        to: RelationTarget;
    }[];
    isOrphanedMetadataKey: (collection: SchemaCollection, key: string) => boolean;
    orphanedMetadataKeys: (collection: SchemaCollection, metadata: {
        readonly [key: string]: unknown;
    }) => string[];
    unknownSelectValues: (collection: SchemaCollection, metadata: {
        readonly [key: string]: unknown;
    }) => {
        path: string;
        values: string[];
    }[];
    schemaMetadata: <T>(collection: SchemaCollection, metadata: {
        readonly [key: string]: T;
    }) => Record<string, T>;
    metadataReferences: (collection: SchemaCollection, metadata: {
        readonly [key: string]: unknown;
    }) => MetadataReference[];
    relationRule: (collection: SchemaCollection, path: string) => {
        to: RelationTarget;
        allowUnpublished: boolean;
    } | undefined;
    missingRequiredIssues: (collection: SchemaCollection, snapshot: {
        slug: string | null;
        metadata: {
            readonly [key: string]: unknown;
        };
    }, options?: {
        localizedOnly?: boolean;
    }) => {
        code: string;
        path: string;
        message?: string;
    }[];
    localizedFieldNames: (collection: SchemaCollection) => {
        own: string[];
        inherit: string[];
    };
    commonFieldKeys: (collection: SchemaCollection, metadata: {
        readonly [key: string]: unknown;
    }) => string[];
    pickLocalizedMetadata: <T>(collection: SchemaCollection, metadata: {
        readonly [key: string]: T;
    }) => Record<string, T>;
    mergeTranslationMetadata: <T>(collection: SchemaCollection, source: {
        readonly [key: string]: T;
    }, translation: {
        readonly [key: string]: T;
    }) => Record<string, T>;
    recordLocalizedFields: (collection: SchemaCollection) => string[];
    normalizeRecordTranslations: (collection: SchemaCollection, value: unknown, locales: readonly string[]) => {
        value: RecordTranslations;
    } | {
        error: string;
        path?: string;
        label?: string;
    };
};
