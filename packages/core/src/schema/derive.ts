import type { CollectionsConfig } from "../config/define";
import { isUuid } from "../core/ids";
import { slugify } from "../core/slug";
import type { CollectionSchema } from "./collection";
import {
	type Field,
	type FieldRole,
	isRequiredField,
	RESERVED_METADATA_KEYS,
	type SlugField,
	type StorageType,
	storageTypeOf,
	type TextField,
	type ValueField,
} from "./fields";
import { type StoredField, valueFieldsOf } from "./walk";

export type { StoredField } from "./walk";

/**
 * Builds storage, validation and reference rules from a collection definition. Pure functions that know nothing about the DB, HTTP or React.
 * The server (snapshot validation) and the browser (properties panel and form conversion) use the same rules.
 *
 * The functions that look a collection up by name belong to one site's collections: `createSchemas(config.collections)` returns them, and a `Site` carries them.
 */

/** Collection names (keys of `collections` in the site config). Follows declaration order. */
export type SchemaCollection = string;
/** Target collection of a relation. `to` and `from` in the definition are strings, and `defineConfig` has checked they are real collections. */
export type RelationTarget = SchemaCollection;

/**
 * Validates the meaning of values that passed the storage format check. If there is a problem, returns the legacy API's error code.
 */
export function fieldValueError(field: ValueField, value: string | readonly string[]): string | null {
	const values = typeof value === "string" ? [value] : value;
	switch (field.kind) {
		case "text":
			if (field.max !== undefined && values.some((item) => Array.from(item).length > (field.max ?? 0))) {
				return "field_too_long";
			}
			return null;
		case "select":
			return values.every((item) => Object.hasOwn(field.options, item)) ? null : "invalid_metadata_value";
		case "relation":
			return values.every((item) => isUuid(item)) ? null : "invalid_metadata_value";
		case "media":
			// An emptied value (`""`) means nothing was chosen.
			return values.every((item) => item === "" || isUuid(item)) ? null : "invalid_metadata_value";
	}
}

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
 * Required-value problem code. The address field is `null_slug` and the rest (including title) are `missing_field`, with the field name in `path`
 * and the field label in `message`.
 */
const NULL_SLUG = "null_slug";

const isEmptyValue = (value: unknown) =>
	value === undefined ||
	value === null ||
	(typeof value === "string" && value === "") ||
	(Array.isArray(value) && value.length === 0);

/**
 * Metadata key that holds the per-language values of item collections (categories, tags, collections). It cannot be used as a field name (`defineConfig`).
 * `{ en: { title: "..." }, ja: { ... } }`. The address and links are shared, so records are not split per language.
 */
export const RECORD_TRANSLATIONS_KEY = RESERVED_METADATA_KEYS[0] as "translations";

export type RecordTranslations = { readonly [locale: string]: { readonly [field: string]: string } };

/** The storage, validation and reference rules of one site's collections. */
export type SiteSchemas = ReturnType<typeof createSchemas>;

/** The rules of the collections of one site config (`config.collections`). */
export function createSchemas(collections: CollectionsConfig) {
	const schemaOf = (collection: SchemaCollection): CollectionSchema => collections[collection] as CollectionSchema;

	const storedCache = new Map<SchemaCollection, readonly StoredField[]>();

	/** Stored field list. Follows declaration order, and fields dependent on a conditional field come right after that field. */
	function storedFields(collection: SchemaCollection): readonly StoredField[] {
		const cached = storedCache.get(collection);
		if (cached) return cached;
		const result = Object.freeze(valueFieldsOf(schemaOf(collection)));
		storedCache.set(collection, result);
		return result;
	}

	function storedField(collection: SchemaCollection, name: string): StoredField | undefined {
		return storedFields(collection).find((stored) => stored.name === name);
	}

	function slugFieldOf(collection: SchemaCollection): SlugField | undefined {
		return Object.values(schemaOf(collection).fields).find((field): field is SlugField => field.kind === "slug");
	}

	/**
	 * The stored field with that role (`role`). `undefined` if none. Library and extension code looks up values such as the summary not by field name but
	 * with this function.
	 */
	function roleField(collection: SchemaCollection, role: FieldRole): StoredField | undefined {
		return storedFields(collection).find((stored) => stored.field.role === role);
	}

	/** The value (string) of that role's field. `""` if the field is missing or the value is not a string. */
	function roleValue(
		collection: SchemaCollection,
		role: FieldRole,
		values: { readonly [key: string]: unknown },
	): string {
		const stored = roleField(collection, role);
		const value = stored ? values[stored.name] : undefined;
		return typeof value === "string" ? value : "";
	}

	/** A field filled from the start of the body when publishing if empty (`fillFromBody`). */
	function fillFromBodyFields(collection: SchemaCollection): (StoredField & { readonly field: TextField })[] {
		return storedFields(collection).filter(
			(stored): stored is StoredField & { readonly field: TextField } =>
				stored.field.kind === "text" && Boolean(stored.field.fillFromBody),
		);
	}

	/**
	 * Address built from the value that the address field's `from` points to. `""` if `from` is absent or the value is empty (not generated automatically).
	 */
	function slugFromValues(collection: SchemaCollection, values: { readonly [key: string]: unknown }): string {
		const from = slugFieldOf(collection)?.from;
		const source = from ? values[from] : undefined;
		return typeof source === "string" ? slugify(source) : "";
	}

	/** Field name → storage format. Same shape as the legacy `COLLECTION_DEFINITIONS.fields`. */
	function storageTypes(collection: SchemaCollection): Record<string, StorageType> {
		return Object.fromEntries(storedFields(collection).map(({ name, field }) => [name, storageTypeOf(field)]));
	}

	/** List of relation fields. Same shape as the legacy `COLLECTION_DEFINITIONS.relations`. */
	function relationsOf(collection: SchemaCollection): { field: string; kind: "entry"; to: RelationTarget }[] {
		return storedFields(collection).flatMap(({ name, field }) =>
			field.kind === "relation" ? [{ field: name, kind: "entry" as const, to: field.to as RelationTarget }] : [],
		);
	}

	/**
	 * Whether a metadata key is an "orphaned value": a value whose field is no longer in the schema (the site removed the field).
	 * The per-language names of an item collection (`translations`) are not orphaned: the core owns that key.
	 */
	function isOrphanedMetadataKey(collection: SchemaCollection, key: string): boolean {
		return key !== RECORD_TRANSLATIONS_KEY && !storedField(collection, key);
	}

	/** Keys of the metadata whose fields are no longer in the schema, in the order they are stored. They are kept, never validated or shown as fields. */
	function orphanedMetadataKeys(collection: SchemaCollection, metadata: { readonly [key: string]: unknown }): string[] {
		return Object.keys(metadata).filter((key) => isOrphanedMetadataKey(collection, key));
	}

	/**
	 * Select values that are no longer an option of their field (the site removed the option). They are kept as stored, never replaced by the default.
	 * One entry per field, in declaration order, listing each unknown value once.
	 */
	function unknownSelectValues(
		collection: SchemaCollection,
		metadata: { readonly [key: string]: unknown },
	): { path: string; values: string[] }[] {
		const found: { path: string; values: string[] }[] = [];
		for (const { name, field } of storedFields(collection)) {
			if (field.kind !== "select") continue;
			const value = metadata[name];
			const values = typeof value === "string" ? [value] : Array.isArray(value) ? value : [];
			const unknown = [...new Set(values.filter((item): item is string => typeof item === "string"))].filter(
				(item) => !Object.hasOwn(field.options, item),
			);
			if (unknown.length > 0) found.push({ path: name, values: unknown });
		}
		return found;
	}

	/** The metadata as the current schema types it: values of removed fields are left out (the public read shows no orphaned values). */
	function schemaMetadata<T>(collection: SchemaCollection, metadata: { readonly [key: string]: T }): Record<string, T> {
		return Object.fromEntries(Object.entries(metadata).filter(([key]) => !isOrphanedMetadataKey(collection, key)));
	}

	/**
	 * Collects references of metadata relation and media fields in declaration order. For multi-value fields, order and duplicates are preserved.
	 * Dependent fields whose condition does not match are also collected if they have a value (every stored value is tracked). Media references are used for media usages,
	 * filtering "unused", and blocking deletion of files in use.
	 */
	function metadataReferences(
		collection: SchemaCollection,
		metadata: { readonly [key: string]: unknown },
	): MetadataReference[] {
		const references: MetadataReference[] = [];
		for (const { name, field } of storedFields(collection)) {
			if (field.kind !== "relation" && field.kind !== "media") continue;
			const kind = field.kind === "media" ? "media" : "entry";
			const value = metadata[name];
			if (value === "") continue;
			if (typeof value === "string") references.push({ kind, targetId: value, path: name });
			else if (Array.isArray(value)) {
				value.forEach((id, ordinal) => {
					if (typeof id === "string") references.push({ kind, targetId: id, path: name, ordinal });
				});
			}
		}
		return references;
	}

	/** Target collection a relation field expects, and whether unpublished targets are allowed. */
	function relationRule(
		collection: SchemaCollection,
		path: string,
	): { to: RelationTarget; allowUnpublished: boolean } | undefined {
		const stored = storedField(collection, path);
		if (stored?.field.kind !== "relation") return undefined;
		return { to: stored.field.to as RelationTarget, allowUnpublished: stored.field.allowUnpublished === true };
	}

	/** Problems of fields (`required`) that must not be empty when publishing (when saving for item collections). */
	function missingRequiredIssues(
		collection: SchemaCollection,
		snapshot: { slug: string | null; metadata: { readonly [key: string]: unknown } },
		options: { localizedOnly?: boolean } = {},
	): { code: string; path: string; message?: string }[] {
		const issues: { code: string; path: string; message?: string }[] = [];
		// A translation has only per-language values, so common required values (category etc.) are checked on the source (translation group).
		const required = (field: Field) =>
			"required" in field && isRequiredField(field) && (!options.localizedOnly || Boolean(field.localized));
		for (const [name, field] of Object.entries(schemaOf(collection).fields)) {
			if (field.kind !== "slug" || !required(field)) continue;
			if (!snapshot.slug) issues.push({ code: NULL_SLUG, path: name });
		}
		for (const { name, field, when } of storedFields(collection)) {
			if (!required(field)) continue;
			if (when && snapshot.metadata[when.field] !== when.value) continue;
			if (isEmptyValue(snapshot.metadata[name])) {
				issues.push({ code: "missing_field", path: name, message: field.label });
			}
		}
		return issues;
	}

	/** Names of per-language fields. Unmarked fields are shared by the translation group. */
	function localizedFieldNames(collection: SchemaCollection): { own: string[]; inherit: string[] } {
		const own: string[] = [];
		const inherit: string[] = [];
		for (const [name, field] of Object.entries(schemaOf(collection).fields)) {
			if (field.kind === "backlink" || field.kind === "view") continue;
			if (field.localized === true) own.push(name);
			else if (field.localized === "inherit") inherit.push(name);
		}
		return { own, inherit };
	}

	/** Common field keys a translation must not have. Stored fields whose definition has no `localized` (not values of removed fields). */
	function commonFieldKeys(collection: SchemaCollection, metadata: { readonly [key: string]: unknown }): string[] {
		const { own, inherit } = localizedFieldNames(collection);
		const localized = new Set([...own, ...inherit]);
		// Values of removed fields are not common fields: they stay wherever they are stored.
		return Object.keys(metadata).filter((key) => !localized.has(key) && !isOrphanedMetadataKey(collection, key));
	}

	/** Picks only the per-language values to carry from the source metadata to the translation. */
	function pickLocalizedMetadata<T>(
		collection: SchemaCollection,
		metadata: { readonly [key: string]: T },
	): Record<string, T> {
		const { own, inherit } = localizedFieldNames(collection);
		const localized = new Set([...own, ...inherit]);
		return Object.fromEntries(Object.entries(metadata).filter(([key]) => localized.has(key)));
	}

	/** Public metadata of a translation = common values of the source + per-language values of the translation. */
	function mergeTranslationMetadata<T>(
		collection: SchemaCollection,
		source: { readonly [key: string]: T },
		translation: { readonly [key: string]: T },
	): Record<string, T> {
		const { own, inherit } = localizedFieldNames(collection);
		const localized = new Set([...own, ...inherit]);
		const common = Object.fromEntries(Object.entries(source).filter(([key]) => !localized.has(key)));
		return { ...common, ...translation };
	}

	/** Text fields of an item collection that can have per-language values. */
	function recordLocalizedFields(collection: SchemaCollection): string[] {
		const schema = schemaOf(collection);
		if (schema.kind !== "item") return [];
		return Object.entries(schema.fields)
			.filter(([, field]) => field.kind === "text" && field.localized === true)
			.map(([name]) => name);
	}

	/**
	 * Validates and normalizes the per-language values of a record. Accepts only languages other than the default language and the per-language text fields of the definition.
	 * Empty values and empty languages are removed. For a bad shape, it returns `error` so the v1 error code can be thrown.
	 */
	function normalizeRecordTranslations(
		collection: SchemaCollection,
		value: unknown,
		locales: readonly string[],
	): { value: RecordTranslations } | { error: string; path?: string; label?: string } {
		const fieldsAllowed = recordLocalizedFields(collection);
		const isPlain = (item: unknown): item is Record<string, unknown> =>
			typeof item === "object" &&
			item !== null &&
			!Array.isArray(item) &&
			(Object.getPrototypeOf(item) === Object.prototype || Object.getPrototypeOf(item) === null);
		if (fieldsAllowed.length === 0) return { error: "invalid_metadata_key" };
		if (!isPlain(value)) return { error: "invalid_metadata_type" };
		const result: Record<string, Record<string, string>> = {};
		for (const [locale, values] of Object.entries(value)) {
			if (!locales.includes(locale)) return { error: "invalid_metadata_value" };
			if (!isPlain(values)) return { error: "invalid_metadata_type" };
			const cleaned: Record<string, string> = {};
			for (const [name, text] of Object.entries(values)) {
				const field = storedField(collection, name)?.field;
				if (!fieldsAllowed.includes(name) || field?.kind !== "text") return { error: "invalid_metadata_key" };
				if (typeof text !== "string") return { error: "invalid_metadata_type" };
				const error = fieldValueError(field, text);
				if (error) return { error, path: `${RECORD_TRANSLATIONS_KEY}.${locale}.${name}`, label: field.label };
				if (text.trim()) cleaned[name] = text.trim();
			}
			if (Object.keys(cleaned).length > 0) result[locale] = cleaned;
		}
		return { value: result };
	}

	return {
		schemaOf,
		storedFields,
		storedField,
		slugFieldOf,
		roleField,
		roleValue,
		fillFromBodyFields,
		slugFromValues,
		storageTypes,
		relationsOf,
		isOrphanedMetadataKey,
		orphanedMetadataKeys,
		unknownSelectValues,
		schemaMetadata,
		metadataReferences,
		relationRule,
		missingRequiredIssues,
		localizedFieldNames,
		commonFieldKeys,
		pickLocalizedMetadata,
		mergeTranslationMetadata,
		recordLocalizedFields,
		normalizeRecordTranslations,
	};
}
