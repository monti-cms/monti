/**
 * The structure values of a site (doc 01): what the site's code relies on, kept in `monti.schema.ts` and changed only on the dev server. Labels, help
 * texts, layout and editor permissions are admin values in the database (`AdminValues`), never here.
 */

/** How a field's value relates to the entry's language (doc 04). */
export type LocaleMode = "same" | "perLocale" | "fromSource";

type FieldBase = {
	required?: boolean;
	/** Shown instead of the title in lists and relation pickers. */
	asTitle?: boolean;
	locale?: LocaleMode;
};

export type TextField = FieldBase & {
	kind: "text";
	multiline?: boolean;
	max?: number;
	/** Filled from the body when left empty (the assistant's quick task, doc 10). */
	fillFromBody?: boolean;
};
/** The entry's address part. Every collection has one, named `slug`. */
export type SlugField = FieldBase & { kind: "slug"; from?: string };
export type SelectField = FieldBase & { kind: "select"; options: string[]; many?: boolean };
export type MediaField = FieldBase & { kind: "media"; accept?: "image" | "any" };
export type RelationField = FieldBase & {
	kind: "relation";
	/** The collection it points at. */
	to: string;
	many?: boolean;
	/** Typing a name that is not in the list creates it. */
	createMissing?: boolean;
};

export type FieldDefinition = TextField | SlugField | SelectField | MediaField | RelationField;
export type FieldKind = FieldDefinition["kind"];

export type CollectionDefinition = {
	/** `document`: a body, drafts and publishing (posts, memos). `item`: short, live on save (categories, tags). */
	kind: "document" | "item";
	/** The public address: a prefix and `/:slug`. */
	path: string;
	/** In this order; `title` and `slug` come first in every collection. */
	fields: Record<string, FieldDefinition>;
};

export type Schema = { collections: Record<string, CollectionDefinition> };

/** The schema of `monti.schema.ts`. It is a plain value: the admin writes this file back, so it holds no code. */
export function defineSchema(schema: Schema): Schema {
	return schema;
}

export const IDENTIFIER = /^[a-z][a-zA-Z0-9]*$/;
/** Names a collection may not take: its read view (`monti_<collection>`) would clash with the core's own tables. */
export const RESERVED_COLLECTIONS = new Set(["activity", "delivery", "proposal", "migration"]);
export const PATH = /^(\/[a-z0-9-]+)*\/:slug$/;

/** What the schema must fix before it can be saved (flow 4, step 09). */
export type SchemaProblem = {
	collection: string;
	field?: string;
	code:
		| "badIdentifier"
		| "reserved"
		| "badPath"
		| "missingTitle"
		| "missingSlug"
		| "noOptions"
		| "duplicateOption"
		| "unknownTarget"
		| "badMax"
		| "pathTaken";
};

export function checkSchema(schema: Schema): SchemaProblem[] {
	const problems: SchemaProblem[] = [];
	const paths = new Map<string, string>();
	for (const [name, collection] of Object.entries(schema.collections)) {
		if (!IDENTIFIER.test(name)) problems.push({ collection: name, code: "badIdentifier" });
		if (RESERVED_COLLECTIONS.has(name)) problems.push({ collection: name, code: "reserved" });
		if (!PATH.test(collection.path)) problems.push({ collection: name, code: "badPath" });
		if (paths.has(collection.path)) problems.push({ collection: name, code: "pathTaken" });
		paths.set(collection.path, name);
		if (collection.fields.title?.kind !== "text")
			problems.push({ collection: name, field: "title", code: "missingTitle" });
		if (collection.fields.slug?.kind !== "slug")
			problems.push({ collection: name, field: "slug", code: "missingSlug" });
		for (const [fieldName, field] of Object.entries(collection.fields)) {
			const at = { collection: name, field: fieldName };
			if (!IDENTIFIER.test(fieldName)) problems.push({ ...at, code: "badIdentifier" });
			if (field.kind === "select") {
				if (field.options.length === 0) problems.push({ ...at, code: "noOptions" });
				if (new Set(field.options).size !== field.options.length) problems.push({ ...at, code: "duplicateOption" });
			}
			if (field.kind === "relation" && !schema.collections[field.to]) problems.push({ ...at, code: "unknownTarget" });
			if (field.kind === "text" && field.max !== undefined && !(Number.isInteger(field.max) && field.max > 0))
				problems.push({ ...at, code: "badMax" });
		}
	}
	return problems;
}
