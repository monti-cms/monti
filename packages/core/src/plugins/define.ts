import type { Kysely, Transaction } from "kysely";
import type { Database } from "../db/schema";
import type { Entry } from "../entries/record";
import type { Actor, Message } from "../operation";
import {
	type CollectionDefinition,
	type GroupField,
	IDENTIFIER,
	MAX_FIELD_NAME,
	type Schema,
	storedFields,
} from "../schema/define";

type Awaitable<T> = T | Promise<T>;

/** A field a plugin adds that holds a value: any kind a group can hold, with the name the admin shows it under (doc 14). */
export type PluginValueField = GroupField & {
	label: string;
	/** For the assistant: how to fill the field. */
	description?: string;
	/** A select's options as the admin names them. */
	optionLabels?: Record<string, string>;
};

/**
 * A field with no value: one view drawn in the property panel (a search result preview, a share card). `view` names the component the
 * plugin's admin half brings (`defineAdminPlugin`'s `views`).
 */
export type PluginViewField = { kind: "view"; view: string; label?: string };

export type PluginField = PluginValueField | PluginViewField;

/**
 * The fields a plugin adds to collections, in a tab of the property panel that is the plugin's: nobody renames, moves or removes it in the
 * settings (doc 01, the locked tab). They are not written to `monti.schema.ts`; they are there while the plugin is.
 */
export type PluginFieldSet = {
	/** The tab's name. */
	tab: string;
	/** The document collections it adds to; every document collection when left out. */
	collections?: readonly string[];
	/** In this order. A name the collection's own schema already has is left to the schema. */
	fields: Record<string, PluginField>;
	/** Which of its value fields a list offers as columns ("add column"), each filtered by "empty" or its kind's own filter (doc 06). */
	columns?: readonly string[];
};

/** A place where a plugin keeps a service key of its own (doc 14, "plugin keys"): the keys screen has a row for it. */
export type KeySlot = {
	/** Unique within the plugin. */
	id: string;
	/** What the key is for, shown after the plugin's name when the plugin has more than one ("Search key"). */
	label: string;
	/** The key service it is for: one of the site's (`keyServices`, the core's or a plugin's). */
	service: string;
};

/** One thing a text check found in a block: the words from `from` to `to` (offsets in the block's text) should be `replacement`. */
export type TextFinding = {
	block: string;
	from: number;
	to: number;
	replacement: string;
	/** Why, in a few words. */
	note?: string;
};

/**
 * A check of the body's words (spelling): it is given each block's text and answers with what to change. Its findings gather in a cell of
 * the editor's status bar, where a person fixes them one by one or all at once (doc 03). It never blocks a publish: that is a publish check.
 */
export type TextCheck = {
	/** The cell's name ("Spelling"). */
	label: string;
	/** The languages it reads; every language when left out. An entry in another language has no cell. */
	locales?: readonly string[];
	check: (
		blocks: readonly { id: string; text: string }[],
		context: { collection: string; locale: string },
	) => Awaitable<TextFinding[]>;
};

/** An entry as it is about to be saved: the working copy after the draft was laid over it. */
export type SavingEntry = {
	/** `null` for an entry being created. */
	id: string | null;
	collection: string;
	locale: string;
	title: string;
	slug: string;
	values: Record<string, unknown>;
	doc: unknown;
};

/**
 * Runs before an entry is saved (`entries.create`, `entries.save`), inside the write. It changes the values that will be saved by returning
 * them, and stops the save by throwing a `CheckError` with why. What it returns passes the same checks as a person's values (a field the
 * schema has, an option the field lists, a file the library has): a hook writes nothing a save could not.
 */
export type BeforeSave = (
	entry: SavingEntry,
	context: {
		db: Kysely<Database> | Transaction<Database>;
		schema: Schema;
		/** The entry as it was stored before this save; `null` for a new one. */
		previous: Entry | null;
		actor: Actor;
	},
) => Awaitable<undefined | { title?: string; slug?: string; values?: Record<string, unknown> }>;

/** A tab a plugin adds to the tools page. Its screen is the component of the same id in the plugin's admin half (`toolPages`). */
export type ToolPage = { id: string; label: string };

/**
 * A file format the import reads besides Monti's own (doc 14: the MDX plugin's `.md` and `.mdx`). The import (`data.inspect`,
 * `data.import`) asks the importer whose `extensions` name the file.
 */
export type Importer = {
	id: string;
	label: string;
	/** With the dot: `.md`, `.mdx`. */
	extensions: readonly string[];
	/** One file as one entry: its front matter as loose values for the field mapping, and its body as a document. */
	read: (file: { name: string; text: string }) => Awaitable<{
		values: Record<string, unknown>;
		doc: unknown;
		/** What it could not turn into a block (a component it does not know), by name. */
		unknown?: string[];
	}>;
};

/** A plugin's tab on one collection, as the admin draws it. */
export type PluginTab = {
	plugin: string;
	tab: string;
	fields: {
		name: string;
		/** `view`, or the kind of the value field. */
		kind: string;
		label?: string;
		description?: string;
		optionLabels?: Record<string, string>;
		/** For a field with no value: the view to draw. */
		view?: string;
		/** A list offers it as a column. */
		column: boolean;
	}[];
};

export type NamedFieldSet = { plugin: string; set: PluginFieldSet };

const VALUE_KINDS = new Set(["text", "select", "media", "relation"]);

/** Whether two sets can meet on one collection. */
const meet = (a: PluginFieldSet, b: PluginFieldSet) =>
	!a.collections || !b.collections || a.collections.some((collection) => b.collections?.includes(collection));

/** Refuses field sets that could never work, when the site is built: a bad name, a kind a plugin cannot add, one name from two sets. */
export function checkFieldSets(sets: readonly NamedFieldSet[]): void {
	for (const { plugin, set } of sets) {
		const at = `Plugin ${plugin}, tab "${set.tab}"`;
		if (set.tab.trim() === "") throw new Error(`Plugin ${plugin} has a field tab with no name.`);
		for (const [name, field] of Object.entries(set.fields)) {
			if (!IDENTIFIER.test(name) || name.length > MAX_FIELD_NAME || name === "title" || name === "slug")
				throw new Error(`${at}: "${name}" cannot be a field's name.`);
			if (field.kind === "view") {
				if (!field.view) throw new Error(`${at}: the view field "${name}" names no view.`);
				continue;
			}
			if (!VALUE_KINDS.has(field.kind))
				throw new Error(`${at}: a plugin's field is a text, select, media or relation field; "${name}" is none.`);
			if (
				field.kind === "select" &&
				(field.options.length === 0 || field.options.some((option) => option.trim() === ""))
			)
				throw new Error(`${at}: the select field "${name}" needs options, none of them empty.`);
		}
		for (const column of set.columns ?? []) {
			const field = set.fields[column];
			if (!field || field.kind === "view")
				throw new Error(`${at}: the column "${column}" is none of its value fields.`);
		}
	}
	for (const [index, a] of sets.entries())
		for (const b of sets.slice(index + 1))
			if (meet(a.set, b.set))
				for (const name of Object.keys(a.set.fields))
					if (name in b.set.fields)
						throw new Error(
							`The field "${name}" is added twice to one collection (plugin ${a.plugin} and plugin ${b.plugin}).`,
						);
}

/** The sets that add to a collection: a document collection the set names, or any when it names none. */
const setsOf = (sets: readonly NamedFieldSet[], name: string, collection: CollectionDefinition) =>
	collection.kind === "document" ? sets.filter(({ set }) => !set.collections || set.collections.includes(name)) : [];

/**
 * A set's fields a collection takes: not one its own schema names (the schema file is the site's code and stands), and not a relation to
 * a collection the site does not have.
 */
function taken(schema: Schema, collection: CollectionDefinition, set: PluginFieldSet): [string, PluginField][] {
	const own = storedFields(collection);
	return Object.entries(set.fields).filter(
		([name, field]) => !(name in own) && !(field.kind === "relation" && !schema.collections[field.to]),
	);
}

/** The value field as the schema holds it: without what only the admin reads. */
function structureOf(field: PluginValueField): GroupField {
	const { label: _label, description: _description, optionLabels: _optionLabels, ...structure } = field;
	return structure as GroupField;
}

/**
 * The schema the site runs with: the file's, and in each document collection the value fields its plugins add, after the file's own. A
 * site with no field sets runs with the file's schema itself.
 */
export function withPluginFields(schema: Schema, sets: readonly NamedFieldSet[]): Schema {
	if (sets.length === 0) return schema;
	const collections: Schema["collections"] = {};
	for (const [name, collection] of Object.entries(schema.collections)) {
		const added: Record<string, GroupField> = {};
		for (const { set } of setsOf(sets, name, collection))
			for (const [field, definition] of taken(schema, collection, set))
				if (definition.kind !== "view") added[field] = structureOf(definition);
		collections[name] =
			Object.keys(added).length === 0 ? collection : { ...collection, fields: { ...collection.fields, ...added } };
	}
	return { ...schema, collections };
}

/** The plugins' tabs of one collection, in the plugins' order. */
export function pluginTabsOf(schema: Schema, sets: readonly NamedFieldSet[], name: string): PluginTab[] {
	const collection = schema.collections[name];
	if (!collection) return [];
	return setsOf(sets, name, collection)
		.map(({ plugin, set }) => ({
			plugin,
			tab: set.tab,
			fields: taken(schema, collection, set).map(([field, definition]) =>
				definition.kind === "view"
					? {
							name: field,
							kind: "view",
							view: definition.view,
							...(definition.label ? { label: definition.label } : {}),
							column: false,
						}
					: {
							name: field,
							kind: definition.kind,
							label: definition.label,
							...(definition.description ? { description: definition.description } : {}),
							...(definition.optionLabels ? { optionLabels: definition.optionLabels } : {}),
							column: set.columns?.includes(field) ?? false,
						},
			),
		}))
		.filter((tab) => tab.fields.length > 0);
}

/** A draft schema without the fields that are a plugin's: what `monti.schema.ts` holds. A draft made from what `schema.read` gave carries them. */
export function withoutPluginFields(file: Schema, sets: readonly NamedFieldSet[], draft: Schema): Schema {
	if (sets.length === 0) return draft;
	const collections: Schema["collections"] = {};
	for (const [name, collection] of Object.entries(draft.collections)) {
		const before = file.collections[name];
		const theirs = new Set(
			before ? setsOf(sets, name, before).flatMap(({ set }) => taken(file, before, set).map(([field]) => field)) : [],
		);
		const fields = Object.fromEntries(Object.entries(collection.fields).filter(([field]) => !theirs.has(field)));
		collections[name] = { ...collection, fields } as CollectionDefinition;
	}
	return { ...draft, collections };
}

/** The field sets of a list of plugins, each with its plugin's name. */
export const fieldSetsOf = (
	plugins: readonly { name: string; fields?: readonly PluginFieldSet[] }[],
): NamedFieldSet[] => plugins.flatMap((plugin) => (plugin.fields ?? []).map((set) => ({ plugin: plugin.name, set })));

/** Words a plugin says in the site's own language, as a message: a check's row, why a save was refused. */
export const says = (text: string): Message => ({ key: "plugins.says", values: { text } });
