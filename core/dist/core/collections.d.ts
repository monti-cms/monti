import type { CollectionKind } from "../schema/collection.js";
import { type SchemaCollection, type StoredField } from "../schema/derive.js";
import type { StorageType } from "../schema/fields.js";
/** Collection names (keys of `collections` in `cms.config.ts`). Follows declaration order. */
export type Collection = SchemaCollection;
export declare const COLLECTIONS: readonly Collection[];
export type { CollectionKind, CollectionWorkflow } from "../schema/collection.js";
export type FieldType = StorageType;
export interface CollectionRelation {
    readonly field: string;
    readonly kind: "entry";
}
/** v1-shaped collection summary. Fields and relations are built from the definitions in the site config (`cms.config.ts`). */
export interface CollectionDefinition {
    readonly name: Collection;
    readonly label: string;
    readonly kind: CollectionKind;
    readonly fields: Readonly<Record<string, FieldType>>;
    readonly relations?: readonly CollectionRelation[];
}
export declare const COLLECTION_DEFINITIONS: Readonly<Record<Collection, CollectionDefinition>>;
export declare function isCollection(val: unknown): val is Collection;
/** Is this an item collection (`kind: "item"`, e.g. tags) where an explicit save is the public change? */
export declare function isItemCollection(val: unknown): boolean;
/** Is this a document collection (`kind: "document"`, e.g. posts) that separates draft and publish? */
export declare const isDocumentCollection: (val: unknown) => val is Collection;
/** Document collections (`kind: "document"`). */
export declare const DOCUMENT_COLLECTIONS: string[];
/** @deprecated `isItemCollection`. */
export declare const isRecordCollection: typeof isItemCollection;
/** @deprecated `DOCUMENT_COLLECTIONS`. */
export declare const CONTENT_COLLECTIONS: string[];
/** @deprecated `isDocumentCollection`. */
export declare const isContentCollection: typeof isDocumentCollection;
/** The collection opened when the URL names none. The first content collection, or the first collection if none. */
export declare const DEFAULT_COLLECTION: Collection;
/**
 * Classification fields: relation fields pointing to an item collection (`kind: "item"`) (e.g. tags, categories). The list columns and filters, bulk actions,
 * and row menus are built from these fields. Relations pointing to content (replacement posts, compilation post lists, etc.) are excluded.
 */
export declare function taxonomyFieldsOf(collection: string): Array<StoredField & {
    readonly to: Collection;
}>;
