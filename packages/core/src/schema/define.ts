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
	/** Preserve manual order of items in a many-value field (doc 08, T74). */
	ordered?: boolean;
	/** Edit a many: true relation field named `via` on target collection `to` from the pointing side (doc 08, T74). */
	via?: string;
};

/** A field that can stand in a conditional field's group: any kind but the address. A conditional field may: its fields are its option's. */
export type GroupField = TextField | SelectField | MediaField | RelationField | ConditionalField;
/**
 * A choice with fields of its own for each option (doc 19): the entry holds the chosen option under this field's name, and only the chosen
 * option's fields are shown and kept. An option with no group has no fields. Its fields are stored flat, beside the collection's other
 * fields, so their names are the collection's: no two fields of a collection share a name, whichever group they are in.
 */
export type ConditionalField = FieldBase & {
	kind: "conditional";
	options: string[];
	fields: Record<string, Record<string, GroupField>>;
	/**
	 * How the choice is made in the editor. `toggle`: the field has one option, and a switch turns it on and off (on is the option
	 * chosen, off is no choice). Left out, a menu of the options.
	 */
	control?: "toggle";
};

export type FieldDefinition = TextField | SlugField | SelectField | MediaField | RelationField | ConditionalField;
export type FieldKind = FieldDefinition["kind"];

/**
 * A field's place in a conditional field: the field and the option it belongs to. `above` is that conditional field's own place, when it
 * stands in an option of another: the field is the entry's only where every choice up the chain is made.
 */
export type OptionPlace = { field: string; option: string; above?: OptionPlace };

/**
 * A field as an entry stores it: every kind but `conditional`, which is stored as the choice it is (a select) with its groups' fields beside
 * it. `under` names the conditional field and the option a field belongs to. A choice made by a switch says so (`control`).
 */
export type StoredField = (
	| TextField
	| SlugField
	| (SelectField & { control?: "toggle" })
	| MediaField
	| RelationField
) & {
	under?: OptionPlace;
};

/** A place and the places above it, the field's own first. */
export function placesOf(under: OptionPlace | undefined): OptionPlace[] {
	const places: OptionPlace[] = [];
	for (let place = under; place; place = place.above) places.push(place);
	return places;
}

/** Whether these values have a place's option chosen, and every option above it. A field on its own is always the entry's. */
export const choseIn = (under: OptionPlace | undefined, values: Record<string, unknown>) =>
	placesOf(under).every((place) => values[place.field] === place.option);

/**
 * The fields an entry's values are stored and read by, in the order the schema writes them: a conditional field as its choice, then each
 * option's fields. Everything that reads or writes values goes by these, so a field in a group is listed, searched, linked and translated
 * like any other.
 */
export function storedFields(
	collection: Pick<CollectionDefinition, "fields"> | undefined,
): Record<string, StoredField> {
	const stored: Record<string, StoredField> = {};
	const put = (fields: Record<string, FieldDefinition>, under?: OptionPlace) => {
		for (const [name, field] of Object.entries(fields)) {
			if (field.kind !== "conditional") {
				stored[name] = under ? { ...field, under } : field;
				continue;
			}
			const { fields: groups, kind: _kind, ...choice } = field;
			stored[name] = { ...choice, kind: "select", ...(under ? { under } : {}) };
			for (const [option, group] of Object.entries(groups ?? {}))
				put(group, { field: name, option, ...(under ? { above: under } : {}) });
		}
	};
	put(collection?.fields ?? {});
	return stored;
}

/**
 * The fields that are not the entry's now: those of an option that is not the chosen one (with nothing chosen, or a value the field no longer
 * lists, every option's). They are not shown, not required and not kept.
 */
export function notChosenFields(
	collection: Pick<CollectionDefinition, "fields"> | undefined,
	values: Record<string, unknown>,
): Set<string> {
	const hidden = new Set<string>();
	for (const [name, field] of Object.entries(storedFields(collection)))
		if (!choseIn(field.under, values)) hidden.add(name);
	return hidden;
}

/** An entry's values without those of options that are not chosen: what every reader gives (the site, the list, the uses of files). */
export function chosenValues<Value>(
	collection: Pick<CollectionDefinition, "fields"> | undefined,
	values: Record<string, Value>,
): Record<string, Value> {
	const hidden = notChosenFields(collection, values);
	return hidden.size === 0
		? values
		: Object.fromEntries(Object.entries(values).filter(([field]) => !hidden.has(field)));
}

type CollectionFields = {
	/** In this order; `title` and `slug` come first in every collection. */
	fields: Record<string, FieldDefinition>;
};

export type CollectionDefinition =
	| (CollectionFields & {
			/** A body, drafts, and publishing (posts, memos). */
			kind: "document";
			/** A document always has a public address. */
			path: string;
			/**
			 * The address of the site's own preview page, when it made one (`/preview/:slug`): "Preview" opens the working copy there. Without it the
			 * working copy is previewed at the public address (doc 16).
			 */
			previewPath?: string;
	  })
	| (CollectionFields & {
			/** Short and live on save (categories, tags). */
			kind: "item";
			/** An item may have a public page; its slug remains an internal identifier without one. */
			path?: string;
	  });

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
export function localeModeOf(name: string, field: Pick<FieldDefinition, "kind" | "locale">): LocaleMode {
	if (field.locale) return field.locale;
	// A translation may use the source's picture or its own (doc 09, 2026-11-09).
	if (field.kind === "media") return "fromSource";
	return name === "title" ? "perLocale" : name === "slug" ? "fromSource" : "same";
}

/** Whether the site writes in more than one language: then the admin shows language tabs, "+ Language" and the list's language column (doc 04). */
export const translates = (schema: Schema) => schema.locales.list.length > 1;

/** The schema of `monti.schema.ts`. It is a plain value: the admin writes this file back, so it holds no code. */
export function defineSchema(schema: Schema): Schema {
	return schema;
}

export const IDENTIFIER = /^[a-z][a-zA-Z0-9]*$/;
/**
 * Postgres keeps 63 bytes of a name and cuts the rest. A collection's read view is `monti_<collection>`, so two collection names that share their
 * first 57 letters would be one view; a field is a column of that view.
 */
export const MAX_FIELD_NAME = 63;
export const MAX_COLLECTION_NAME = MAX_FIELD_NAME - "monti_".length;
/**
 * Names a collection may not take: its read view (`monti_<collection>`) would clash with the core's own tables (`monti_activity`, `monti_admin`,
 * `monti_delivery`, `monti_migration`, `monti_proposal`, `monti_session`, `monti_settings`), and `media` is the kind the trash names the library's
 * files and folders by (doc 11). A test holds this list against the tables the migrations make, so a new core table cannot be forgotten.
 */
export const RESERVED_COLLECTIONS = new Set([
	"activity",
	"admin",
	"delivery",
	"media",
	"migration",
	"proposal",
	"session",
	"settings",
]);
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
		| "tooLong"
		| "reserved"
		| "badPath"
		| "missingTitle"
		| "missingSlug"
		| "fixedOptional"
		| "noOptions"
		| "duplicateOption"
		| "emptyOption"
		| "unknownTarget"
		| "badMax"
		| "pathTaken"
		| "badPreviewPath"
		| "previewPathTaken"
		| "invalidVia"
		| "unknownOption"
		| "duplicateField"
		| "notInOption"
		| "choicePerLocale"
		| "badToggle";
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
	const previews = new Map<string, string>();
	for (const [name, collection] of Object.entries(schema.collections)) {
		if (!IDENTIFIER.test(name)) problems.push({ collection: name, code: "badIdentifier" });
		if (name.length > MAX_COLLECTION_NAME) problems.push({ collection: name, code: "tooLong" });
		if (RESERVED_COLLECTIONS.has(name)) problems.push({ collection: name, code: "reserved" });
		if (collection.path === undefined) {
			if (collection.kind === "document") problems.push({ collection: name, code: "badPath" });
		} else {
			if (!PATH.test(collection.path)) problems.push({ collection: name, code: "badPath" });
			if (paths.has(collection.path)) problems.push({ collection: name, code: "pathTaken" });
			paths.set(collection.path, name);
		}
		// A preview address is a document's (an item has no working copy to preview), has the shape of an address, and is no page's own address.
		const previewPath = (collection as { previewPath?: unknown }).previewPath;
		if (previewPath !== undefined) {
			// With a folder of its own (`/preview/:slug`): `/:slug` alone would answer for every address of the site's top level.
			if (
				collection.kind !== "document" ||
				typeof previewPath !== "string" ||
				!PATH.test(previewPath) ||
				previewPath === "/:slug"
			)
				problems.push({ collection: name, code: "badPreviewPath" });
			else previews.set(name, previewPath);
		}
		if (collection.fields.title?.kind !== "text")
			problems.push({ collection: name, field: "title", code: "missingTitle" });
		if (collection.fields.slug?.kind !== "slug")
			problems.push({ collection: name, field: "slug", code: "missingSlug" });
		// Every entry has a title and an address: the two fixed fields are always required.
		for (const fixed of ["title", "slug"] as const)
			if (collection.fields[fixed] && collection.fields[fixed].required !== true)
				problems.push({ collection: name, field: fixed, code: "fixedOptional" });
		// A conditional field's own shape (doc 19): a group for a listed option only, no address inside one, and no name used twice in the
		// collection (the fields are stored side by side). A conditional field in a group is checked the same way, as deep as it goes.
		const names = new Set(Object.keys(collection.fields));
		const checkChoice = (fieldName: string, field: ConditionalField) => {
			// One choice per entry, made on the source: a translation is the same kind of entry as its source.
			// Following the source with a choice of its own where it has one is a choice of its own too.
			if (field.locale !== undefined && field.locale !== "same")
				problems.push({ collection: name, field: fieldName, code: "choicePerLocale" });
			// A switch is one option, on or off: with more there is nothing to tell them apart by, and a required one could never be off.
			if (field.control === "toggle" && (field.options.length !== 1 || field.required))
				problems.push({ collection: name, field: fieldName, code: "badToggle" });
			for (const [option, group] of Object.entries(field.fields ?? {})) {
				if (!field.options.includes(option))
					problems.push({ collection: name, field: fieldName, code: "unknownOption" });
				for (const [inner, definition] of Object.entries(group)) {
					if ((definition as { kind: string }).kind === "slug")
						problems.push({ collection: name, field: inner, code: "notInOption" });
					if (names.has(inner)) problems.push({ collection: name, field: inner, code: "duplicateField" });
					names.add(inner);
					if (definition.kind === "conditional") checkChoice(inner, definition);
				}
			}
		};
		for (const [fieldName, field] of Object.entries(collection.fields))
			if (field.kind === "conditional") checkChoice(fieldName, field);
		for (const [fieldName, field] of Object.entries(storedFields(collection))) {
			const at = { collection: name, field: fieldName };
			if (!IDENTIFIER.test(fieldName)) problems.push({ ...at, code: "badIdentifier" });
			if (fieldName.length > MAX_FIELD_NAME) problems.push({ ...at, code: "tooLong" });
			if (field.kind === "select") {
				if (field.options.length === 0) problems.push({ ...at, code: "noOptions" });
				if (new Set(field.options).size !== field.options.length) problems.push({ ...at, code: "duplicateOption" });
				// An option is the word entries store: one with no word could not be told from no choice.
				if (field.options.some((option) => option.trim() === "")) problems.push({ ...at, code: "emptyOption" });
			}
			if (field.kind === "relation") {
				if (!schema.collections[field.to]) {
					problems.push({ ...at, code: "unknownTarget" });
				} else if (field.via !== undefined) {
					const targetField = storedFields(schema.collections[field.to])[field.via];
					if (!targetField || targetField.kind !== "relation" || targetField.to !== name || targetField.many !== true) {
						problems.push({ ...at, code: "invalidVia" });
					}
				}
			}
			if (field.kind === "text" && field.max !== undefined && !(Number.isInteger(field.max) && field.max > 0))
				problems.push({ ...at, code: "badMax" });
		}
	}
	// A preview page is not a public page, nor another collection's preview page.
	const seen = new Set<string>();
	for (const [name, previewPath] of previews) {
		if (paths.has(previewPath) || seen.has(previewPath)) problems.push({ collection: name, code: "previewPathTaken" });
		seen.add(previewPath);
	}
	return problems;
}
