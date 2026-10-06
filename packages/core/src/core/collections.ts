import { cmsConfig } from "../config/resolved";
import type { CollectionKind } from "../schema/collection";
import {
	relationsOf,
	type SchemaCollection,
	type StoredField,
	schemaOf,
	storageTypes,
	storedFields,
} from "../schema/derive";
import type { StorageType } from "../schema/fields";

/** Collection names (keys of `collections` in `cms.config.ts`). Follows declaration order. */
export type Collection = SchemaCollection;
export const COLLECTIONS = Object.keys(cmsConfig.collections) as readonly Collection[];

export type { CollectionKind } from "../schema/collection";

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

export const COLLECTION_DEFINITIONS: Readonly<Record<Collection, CollectionDefinition>> = Object.fromEntries(
	COLLECTIONS.map((name) => {
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
	}),
) as Record<Collection, CollectionDefinition>;

export function isCollection(val: unknown): val is Collection {
	return typeof val === "string" && (COLLECTIONS as readonly string[]).includes(val);
}

/** Is this an item collection (`kind: "item"`, e.g. tags) where an explicit save is the public change? */
export function isItemCollection(val: unknown): boolean {
	return isCollection(val) && COLLECTION_DEFINITIONS[val].kind === "item";
}

/** Is this a document collection (`kind: "document"`, e.g. posts) that separates draft and publish? */
export const isDocumentCollection = (val: unknown): val is Collection =>
	isCollection(val) && COLLECTION_DEFINITIONS[val].kind === "document";

/** Document collections (`kind: "document"`). */
export const DOCUMENT_COLLECTIONS = COLLECTIONS.filter((c) => COLLECTION_DEFINITIONS[c].kind === "document");

/** The collection opened when the URL names none. The first content collection, or the first collection if none. */
export const DEFAULT_COLLECTION: Collection = (DOCUMENT_COLLECTIONS[0] ?? COLLECTIONS[0]) as Collection;

/**
 * Classification fields: relation fields pointing to an item collection (`kind: "item"`) (e.g. tags, categories). The list columns and filters, bulk actions,
 * and row menus are built from these fields. Relations pointing to content (replacement posts, compilation post lists, etc.) are excluded.
 */
export function taxonomyFieldsOf(collection: string): Array<StoredField & { readonly to: Collection }> {
	if (!isCollection(collection)) return [];
	return storedFields(collection).flatMap((stored) =>
		stored.field.kind === "relation" && isItemCollection(stored.field.to)
			? [{ ...stored, to: stored.field.to as Collection }]
			: [],
	);
}
