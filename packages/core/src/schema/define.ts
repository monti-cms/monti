/**
 * The structure values of a site (doc 01): what the site's code relies on, kept in `monti.schema.ts` and changed only on the dev server. Labels, help
 * texts, layout and editor permissions are admin values in the database (`AdminValues`), never here.
 */

/** How a field's value relates to the entry's language (doc 04). */
export type LocaleMode = "same" | "perLocale" | "fromSource";

type FieldBase = {
	required?: boolean;
	locale?: LocaleMode;
};

export type TextField = FieldBase & {
	kind: "text";
	multiline?: boolean;
	max?: number;
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

/** One language of the site: its code (`ko`, `zh-Hant`) and its name in that language ("한국어", cms-allow-korean: a language's own name). */
export type LocaleDefinition = { code: string; name: string };

/**
 * The site's languages (doc 04): the list, the source language every new entry is written in, and how a public address shows the language. The site's
 * code builds its paths from these, so they live in the file.
 */
export type LocalesDefinition = {
	source: string;
	list: LocaleDefinition[];
	/** `/en/posts/…` for every language, for all but the source, or never. */
	prefix: "always" | "exceptSource" | "never";
};

export type Schema = { locales: LocalesDefinition; collections: Record<string, CollectionDefinition> };

/**
 * How a field's value relates to the language when the schema names no mode: the title is written per language, the address starts from the source's,
 * and every other field is one value for all languages (doc 04).
 */
export function localeModeOf(name: string, field: FieldDefinition): LocaleMode {
	return field.locale ?? (name === "title" ? "perLocale" : name === "slug" ? "fromSource" : "same");
}

/** Whether the site writes in more than one language: then the admin shows language tabs, "+ Language" and the list's language column (doc 04). */
export const translates = (schema: Schema) => schema.locales.list.length > 1;

/** The schema of `monti.schema.ts`. It is a plain value: the admin writes this file back, so it holds no code. */
export function defineSchema(schema: Schema): Schema {
	return schema;
}

export const IDENTIFIER = /^[a-z][a-zA-Z0-9]*$/;
/** Names a collection may not take: its read view (`monti_<collection>`) would clash with the core's own tables. */
export const RESERVED_COLLECTIONS = new Set(["activity", "delivery", "proposal", "migration"]);
export const PATH = /^(\/[a-z0-9-]+)*\/:slug$/;
/** A language code: `ko`, `en`, `zh-Hant`, `pt-BR`. */
export const LOCALE = /^[a-z]{2,3}(-[A-Za-z0-9]{2,8})*$/;

/** What the schema must fix before it can be saved (flow 4, step 09). */
export type SchemaProblem = {
	/** Absent for a problem of the languages. */
	collection?: string;
	field?: string;
	locale?: string;
	code:
		| "noLocales"
		| "badLocale"
		| "duplicateLocale"
		| "unknownSource"
		| "badIdentifier"
		| "reserved"
		| "badPath"
		| "missingTitle"
		| "missingSlug"
		| "fixedOptional"
		| "noOptions"
		| "duplicateOption"
		| "unknownTarget"
		| "badMax"
		| "pathTaken";
};

export function checkSchema(schema: Schema): SchemaProblem[] {
	const problems: SchemaProblem[] = [];
	const { locales } = schema;
	if (locales.list.length === 0) problems.push({ code: "noLocales" });
	const codes = new Set<string>();
	for (const { code } of locales.list) {
		if (!LOCALE.test(code)) problems.push({ locale: code, code: "badLocale" });
		if (codes.has(code)) problems.push({ locale: code, code: "duplicateLocale" });
		codes.add(code);
	}
	if (locales.list.length > 0 && !codes.has(locales.source))
		problems.push({ locale: locales.source, code: "unknownSource" });
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
		// Every entry has a title and an address: the two fixed fields are always required.
		for (const fixed of ["title", "slug"] as const)
			if (collection.fields[fixed] && collection.fields[fixed].required !== true)
				problems.push({ collection: name, field: fixed, code: "fixedOptional" });
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
