import type { CollectionKind } from "../schema/collection.js";
import type { SchemaCollection, SiteSchemas, StoredField } from "../schema/derive.js";
import type { StorageType } from "../schema/fields.js";
/** A collection name (a key of `collections` in the site config). */
export type Collection = SchemaCollection;
export type { CollectionKind } from "../schema/collection.js";
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
/** The collections of one site. */
export type SiteCollections = ReturnType<typeof createCollections>;
/** The collection helpers of a site config's collections (`config.collections`), on top of the rules of its schemas. */
export declare function createCollections(collections: Readonly<Record<string, unknown>>, schemas: Pick<SiteSchemas, "schemaOf" | "relationsOf" | "storageTypes" | "storedFields">): {
    COLLECTIONS: readonly string[];
    COLLECTION_DEFINITIONS: Readonly<Record<string, CollectionDefinition>>;
    isCollection: (val: unknown) => val is Collection;
    isItemCollection: (val: unknown) => boolean;
    isDocumentCollection: (val: unknown) => val is Collection;
    DOCUMENT_COLLECTIONS: readonly string[];
    DEFAULT_COLLECTION: string;
    taxonomyFieldsOf: (collection: string) => Array<StoredField & {
        readonly to: Collection;
    }>;
};
