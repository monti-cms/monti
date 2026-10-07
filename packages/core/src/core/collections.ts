import type { CollectionKind } from "../schema/collection";
import type { SchemaCollection, SiteSchemas, StoredField } from "../schema/derive";
import type { StorageType } from "../schema/fields";

/** A collection name (a key of `collections` in the site config). */
export type Collection = SchemaCollection;

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

/** The collections of one site. */
export type SiteCollections = ReturnType<typeof createCollections>;

/** The collection helpers of a site config's collections (`config.collections`), on top of the rules of its schemas. */
export function createCollections(
	collections: Readonly<Record<string, unknown>>,
	schemas: Pick<SiteSchemas, "schemaOf" | "relationsOf" | "storageTypes" | "storedFields">,
) {
	/** Collection names (keys of `collections` in `cms.config.ts`). Follows declaration order. */
	const COLLECTIONS: readonly Collection[] = Object.keys(collections);

	const COLLECTION_DEFINITIONS: Readonly<Record<Collection, CollectionDefinition>> = Object.fromEntries(
		COLLECTIONS.map((name) => {
			const schema = schemas.schemaOf(name);
			const relations = schemas.relationsOf(name).map(({ field, kind }) => ({ field, kind }));
			return [
				name,
				{
					name,
					label: schema.label,
					kind: schema.kind,
					fields: schemas.storageTypes(name),
					...(relations.length > 0 ? { relations } : {}),
				},
			];
		}),
	);

	const isCollection = (val: unknown): val is Collection => typeof val === "string" && COLLECTIONS.includes(val);

	/** Is this an item collection (`kind: "item"`, e.g. tags) where an explicit save is the public change? */
	const isItemCollection = (val: unknown): boolean => isCollection(val) && COLLECTION_DEFINITIONS[val]?.kind === "item";

	/** Is this a document collection (`kind: "document"`, e.g. posts) that separates draft and publish? */
	const isDocumentCollection = (val: unknown): val is Collection =>
		isCollection(val) && COLLECTION_DEFINITIONS[val]?.kind === "document";

	/** Document collections (`kind: "document"`). */
	const DOCUMENT_COLLECTIONS: readonly Collection[] = COLLECTIONS.filter(
		(c) => COLLECTION_DEFINITIONS[c]?.kind === "document",
	);

	/** The collection opened when the URL names none. The first content collection, or the first collection if none. */
	const DEFAULT_COLLECTION: Collection = (DOCUMENT_COLLECTIONS[0] ?? COLLECTIONS[0]) as Collection;

	/**
	 * Classification fields: relation fields pointing to an item collection (`kind: "item"`) (e.g. tags, categories). The list columns and filters, bulk actions,
	 * and row menus are built from these fields. Relations pointing to content (replacement posts, compilation post lists, etc.) are excluded.
	 */
	function taxonomyFieldsOf(collection: string): Array<StoredField & { readonly to: Collection }> {
		if (!isCollection(collection)) return [];
		return schemas
			.storedFields(collection)
			.flatMap((stored) =>
				stored.field.kind === "relation" && isItemCollection(stored.field.to)
					? [{ ...stored, to: stored.field.to as Collection }]
					: [],
			);
	}

	return {
		COLLECTIONS,
		COLLECTION_DEFINITIONS,
		isCollection,
		isItemCollection,
		isDocumentCollection,
		DOCUMENT_COLLECTIONS,
		DEFAULT_COLLECTION,
		taxonomyFieldsOf,
	};
}
