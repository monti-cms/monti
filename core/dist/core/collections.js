import { cmsConfig } from "../config/resolved.js";
import { relationsOf, schemaOf, storageTypes, storedFields, } from "../schema/derive.js";
export const COLLECTIONS = Object.keys(cmsConfig.collections);
export const COLLECTION_DEFINITIONS = Object.fromEntries(COLLECTIONS.map((name) => {
    const schema = schemaOf(name);
    const relations = relationsOf(name).map(({ field, kind }) => ({ field, kind }));
    return [
        name,
        {
            name,
            label: schema.label,
            kind: schema.kind,
            fields: storageTypes(name),
            ...(relations.length > 0 ? { relations } : {}),
        },
    ];
}));
export function isCollection(val) {
    return typeof val === "string" && COLLECTIONS.includes(val);
}
/** Is this an item collection (`kind: "item"`, e.g. tags) where an explicit save is the public change? */
export function isItemCollection(val) {
    return isCollection(val) && COLLECTION_DEFINITIONS[val].kind === "item";
}
/** Is this a document collection (`kind: "document"`, e.g. posts) that separates draft and publish? */
export const isDocumentCollection = (val) => isCollection(val) && COLLECTION_DEFINITIONS[val].kind === "document";
/** Document collections (`kind: "document"`). */
export const DOCUMENT_COLLECTIONS = COLLECTIONS.filter((c) => COLLECTION_DEFINITIONS[c].kind === "document");
/** @deprecated `isItemCollection`. */
export const isRecordCollection = isItemCollection;
/** @deprecated `DOCUMENT_COLLECTIONS`. */
export const CONTENT_COLLECTIONS = DOCUMENT_COLLECTIONS;
/** @deprecated `isDocumentCollection`. */
export const isContentCollection = isDocumentCollection;
/** The collection opened when the URL names none. The first content collection, or the first collection if none. */
export const DEFAULT_COLLECTION = (DOCUMENT_COLLECTIONS[0] ?? COLLECTIONS[0]);
/**
 * Classification fields: relation fields pointing to an item collection (`kind: "item"`) (e.g. tags, categories). The list columns and filters, bulk actions,
 * and row menus are built from these fields. Relations pointing to content (replacement posts, compilation post lists, etc.) are excluded.
 */
export function taxonomyFieldsOf(collection) {
    if (!isCollection(collection))
        return [];
    return storedFields(collection).flatMap((stored) => stored.field.kind === "relation" && isItemCollection(stored.field.to)
        ? [{ ...stored, to: stored.field.to }]
        : []);
}
