import type { CollectionsConfig } from "../config/define.js";
import type { ErrorCode } from "../core/error-codes.js";
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
export type SchemaCollectionName = string;
/** Target collection of a relation. `to` and `from` in the definition are strings, and `defineSite` has checked they are real collections. */
export type RelationTarget = SchemaCollectionName;
/**
 * Validates the meaning of values that passed the storage format check. If there is a problem, returns the legacy API's error code.
 */
export declare function fieldValueError(field: ValueField, value: string | readonly string[]): ErrorCode | null;
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
 * The per-language values of item collections (categories, tags, collections), kept under the metadata key `RECORD_TRANSLATIONS_KEY`: `{ en: { title: "..." }, ja: { ... } }`.
 * The address and links are shared, so records are not split per language.
 */
export type RecordTranslations = {
    readonly [locale: string]: {
        readonly [field: string]: string;
    };
};
/** The storage, validation and reference rules of one site's collections. */
export type SiteSchemas = ReturnType<typeof createSchemas>;
/** The rules of the collections of one site config (`config.collections`). */
export declare function createSchemas(collections: CollectionsConfig): {
    schemaOf: (collection: SchemaCollectionName) => CollectionSchema;
    storedFields: (collection: SchemaCollectionName) => readonly StoredField[];
    storedField: (collection: SchemaCollectionName, name: string) => StoredField | undefined;
    slugFieldOf: (collection: SchemaCollectionName) => SlugField | undefined;
    roleField: (collection: SchemaCollectionName, role: FieldRole) => StoredField | undefined;
    roleValue: (collection: SchemaCollectionName, role: FieldRole, values: {
        readonly [key: string]: unknown;
    }) => string;
    titleField: (collection: SchemaCollectionName) => TitleField;
    titleOfValues: (collection: SchemaCollectionName, values: {
        readonly [key: string]: unknown;
    }) => string | null;
    fillFromBodyFields: (collection: SchemaCollectionName) => (StoredField & {
        readonly field: TextField;
    })[];
    slugFromValues: (collection: SchemaCollectionName, values: {
        readonly [key: string]: unknown;
    }) => string;
    storageTypes: (collection: SchemaCollectionName) => Record<string, StorageType>;
    relationsOf: (collection: SchemaCollectionName) => {
        field: string;
        kind: "entry";
        to: RelationTarget;
    }[];
    isOrphanedMetadataKey: (collection: SchemaCollectionName, key: string) => boolean;
    orphanedMetadataKeys: (collection: SchemaCollectionName, metadata: {
        readonly [key: string]: unknown;
    }) => string[];
    unknownSelectValues: (collection: SchemaCollectionName, metadata: {
        readonly [key: string]: unknown;
    }) => {
        path: string;
        values: string[];
    }[];
    schemaMetadata: <T>(collection: SchemaCollectionName, metadata: {
        readonly [key: string]: T;
    }) => Record<string, T>;
    metadataReferences: (collection: SchemaCollectionName, metadata: {
        readonly [key: string]: unknown;
    }) => MetadataReference[];
    relationRule: (collection: SchemaCollectionName, path: string) => {
        to: RelationTarget;
        allowUnpublished: boolean;
    } | undefined;
    missingRequiredIssues: (collection: SchemaCollectionName, snapshot: {
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
    localizedFieldNames: (collection: SchemaCollectionName) => {
        own: string[];
        inherit: string[];
    };
    localizedSet: (collection: SchemaCollectionName) => ReadonlySet<string>;
    commonFieldKeys: (collection: SchemaCollectionName, metadata: {
        readonly [key: string]: unknown;
    }) => string[];
    pickLocalizedMetadata: <T>(collection: SchemaCollectionName, metadata: {
        readonly [key: string]: T;
    }) => Record<string, T>;
    mergeTranslationMetadata: <T>(collection: SchemaCollectionName, source: {
        readonly [key: string]: T;
    }, translation: {
        readonly [key: string]: T;
    }) => Record<string, T>;
    recordLocalizedFields: (collection: SchemaCollectionName) => string[];
    normalizeRecordTranslations: (collection: SchemaCollectionName, value: unknown, locales: readonly string[]) => {
        value: RecordTranslations;
    } | {
        error: ErrorCode;
        path?: string;
        label?: string;
    };
};
