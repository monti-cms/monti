import {
	type AdminValues,
	type CollectionDefinition,
	type FieldDefinition,
	type Rename,
	type Schema,
	sameJson,
} from "@monti-cms/core";
import type { Path } from "../../draft/use-draft";

/** What `schema.read` answers. */
export type SchemaRead = {
	schema: Schema;
	hash: string;
	version: number;
	adminValues: Record<string, AdminValues & { version: number }>;
	locked: boolean;
	fileChanged: boolean;
	failedChange: string | null;
};

/** The blocks and marks the site's editor has (`blocks.catalog`), the ones a collection's editor tab turns on and off. */
export type Catalog = {
	blocks: { type: string; label: string | { key: string }; menu: string | null }[];
	marks: { type: string; label: string | { key: string } }[];
};

/** A field as the draft holds it: its name now (a rename changes it) and its definition. Its place in the draft is keyed by the name it came with. */
export type DraftField = { name: string; def: FieldDefinition };

/** The admin values of a field the screen edits. */
export const FIELD_VALUES = ["label", "description", "optionLabels"] as const;
export type FieldValue = (typeof FIELD_VALUES)[number];

/** The heading levels a body can have (doc 03): the editor tab turns each on or off. */
export const HEADINGS = [2, 3, 4] as const;

/**
 * The places of the collections screen's draft. A collection is keyed by its identifier, a field by the name it had when it entered the draft (so a
 * rename keeps its place):
 *
 * - `col:<c>` the collection (`{ kind }`, `null` once deleted) · `path:<c>` its public address
 * - `field:<c>:<key>` a field (`DraftField`, `null` once removed)
 * - `ca:<c>:label|folders|layout` the collection's admin values · `fa:<c>:<key>:<value>` a field's
 * - `ed:<c>:block:<type>`, `ed:<c>:mark:<type>`, `ed:<c>:heading:<level>` what its editor allows
 */
export const at = {
	collection: (c: string) => `col:${c}`,
	path: (c: string) => `path:${c}`,
	field: (c: string, key: string) => `field:${c}:${key}`,
	collectionValue: (c: string, value: "label" | "folders" | "layout") => `ca:${c}:${value}`,
	fieldValue: (c: string, key: string, value: FieldValue) => `fa:${c}:${key}:${value}`,
	editor: (c: string, what: "block" | "mark" | "heading", name: string | number) => `ed:${c}:${what}:${name}`,
};

/** A path split into what it names. */
export type Place =
	| { kind: "collection"; collection: string }
	| { kind: "path"; collection: string }
	| { kind: "field"; collection: string; key: string }
	| { kind: "collectionValue"; collection: string; value: "label" | "folders" | "layout" }
	| { kind: "fieldValue"; collection: string; key: string; value: FieldValue }
	| { kind: "editor"; collection: string; what: "block" | "mark" | "heading"; name: string };

export function placeOf(path: Path): Place | null {
	const [head, collection = "", a = "", b = ""] = path.split(":");
	if (head === "col") return { kind: "collection", collection };
	if (head === "path") return { kind: "path", collection };
	if (head === "field") return { kind: "field", collection, key: a };
	if (head === "ca") return { kind: "collectionValue", collection, value: a as "label" };
	if (head === "fa") return { kind: "fieldValue", collection, key: a, value: b as FieldValue };
	if (head === "ed") return { kind: "editor", collection, what: a as "block", name: b };
	return null;
}

type LayoutField = string | { group: string; fields: string[] };
export type Layout = { tab: string; fields: LayoutField[] }[];

const allows = (list: "all" | string[] | undefined, type: string) =>
	list === undefined || list === "all" || list.includes(type);

/** The blocks a collection's editor tab lists: every block with a menu but the paragraph and the heading (its levels are their own group). */
export const listedBlocks = (catalog: Catalog) =>
	catalog.blocks.filter((block) => block.menu !== null && block.type !== "paragraph" && block.type !== "heading");

/** The saved values, flattened to the draft's places. */
export function flatten(read: SchemaRead, catalog: Catalog | null): Record<Path, unknown> {
	const base: Record<Path, unknown> = {};
	for (const [c, collection] of Object.entries(read.schema.collections)) {
		const values = read.adminValues[c];
		base[at.collection(c)] = { kind: collection.kind };
		base[at.path(c)] = collection.path;
		base[at.collectionValue(c, "label")] = values?.label;
		base[at.collectionValue(c, "folders")] = values?.folders ?? false;
		base[at.collectionValue(c, "layout")] = values?.layout;
		for (const [name, def] of Object.entries(collection.fields)) {
			base[at.field(c, name)] = { name, def } satisfies DraftField;
			for (const value of FIELD_VALUES) base[at.fieldValue(c, name, value)] = values?.fields?.[name]?.[value];
		}
		if (collection.kind === "document" && catalog) {
			const editor = values?.editor;
			for (const block of listedBlocks(catalog))
				base[at.editor(c, "block", block.type)] = allows(editor?.blocks, block.type);
			for (const mark of catalog.marks) base[at.editor(c, "mark", mark.type)] = allows(editor?.marks, mark.type);
			for (const level of HEADINGS)
				base[at.editor(c, "heading", level)] = editor?.headings ? editor.headings.includes(level) : true;
		}
	}
	return base;
}

/** What the screen reads the draft through: the value at a place (mine over saved). */
export type Values = (path: Path) => unknown;

/** The collections in the draft, deleted ones too: the saved ones in their order, then the new ones. */
export function collectionKeys(read: SchemaRead, changed: Path[]): string[] {
	const keys = Object.keys(read.schema.collections);
	for (const path of changed) {
		const place = placeOf(path);
		if (place?.kind === "collection" && !keys.includes(place.collection)) keys.push(place.collection);
	}
	return keys;
}

/** The fields of a collection in the draft, removed ones too: the saved ones in the schema's order, then the new ones in the order they were made. */
export function fieldKeys(read: SchemaRead, changed: Path[], c: string): string[] {
	const keys = Object.keys(read.schema.collections[c]?.fields ?? {});
	for (const path of changed) {
		const place = placeOf(path);
		if (place?.kind === "field" && place.collection === c && !keys.includes(place.key)) keys.push(place.key);
	}
	return keys;
}

/** A place for a new field named `name` that no saved or drafted field holds (a removed `summary` keeps its own). */
export function newFieldKey(taken: string[], name: string): string {
	if (!taken.includes(name)) return name;
	let n = 2;
	while (taken.includes(`${name}~${n}`)) n++;
	return `${name}~${n}`;
}

/** The schema the draft makes, the renames it holds and, for each collection, its admin values in full under the fields' names now. */
export function build(read: SchemaRead, changed: Path[], value: Values, catalog: Catalog | null) {
	// The languages are the settings' language tab's (doc 04): this screen keeps them as they are.
	const schema: Schema = { locales: read.schema.locales, collections: {} };
	const renames: Rename[] = [];
	const adminValues: Record<string, AdminValues> = {};
	for (const c of collectionKeys(read, changed)) {
		const collection = value(at.collection(c)) as { kind: CollectionDefinition["kind"] } | null | undefined;
		if (!collection) continue;
		const fields: Record<string, FieldDefinition> = {};
		const names = new Map<string, string>();
		const keys = fieldKeys(read, changed, c);
		for (const key of keys) {
			const field = value(at.field(c, key)) as DraftField | null | undefined;
			if (!field) continue;
			fields[field.name] = field.def;
			names.set(key, field.name);
			if (read.schema.collections[c]?.fields[key] && field.name !== key)
				renames.push({ collection: c, from: key, to: field.name });
		}
		schema.collections[c] = { kind: collection.kind, path: String(value(at.path(c)) ?? "/:slug"), fields };
		adminValues[c] = collectionValues(read, c, collection.kind, keys, names, value, catalog);
	}
	return { schema, renames, adminValues };
}

function collectionValues(
	read: SchemaRead,
	c: string,
	kind: CollectionDefinition["kind"],
	keys: string[],
	names: Map<string, string>,
	value: Values,
	catalog: Catalog | null,
): AdminValues {
	const saved = read.adminValues[c];
	const out: AdminValues = {};
	const label = value(at.collectionValue(c, "label")) as string | undefined;
	if (label) out.label = label;
	const folders = value(at.collectionValue(c, "folders")) as boolean | undefined;
	if (folders || saved?.folders !== undefined) out.folders = Boolean(folders);
	const fields: NonNullable<AdminValues["fields"]> = {};
	for (const [key, name] of names) {
		const one: Record<string, unknown> = {};
		for (const each of FIELD_VALUES) {
			const v = value(at.fieldValue(c, key, each));
			if (v !== undefined && v !== "") one[each] = v;
		}
		if (Object.keys(one).length > 0) fields[name] = one;
	}
	if (Object.keys(fields).length > 0) out.fields = fields;
	const layout = value(at.collectionValue(c, "layout")) as Layout | undefined;
	if (layout) out.layout = fullLayout(layout, keys, names);
	if (kind === "document" && catalog) {
		const on = (what: "block" | "mark", list: { type: string }[]) => {
			const picked = list.filter((each) => value(at.editor(c, what, each.type)) !== false).map((each) => each.type);
			return picked.length === list.length ? ("all" as const) : picked;
		};
		const blocks = on("block", listedBlocks(catalog));
		// Blocks the tab does not list (the paragraph, the heading) stay on.
		const allBlocks: "all" | string[] =
			blocks === "all"
				? "all"
				: [...catalog.blocks.filter((b) => !listedBlocks(catalog).includes(b)).map((b) => b.type), ...blocks];
		const editor = {
			blocks: allBlocks,
			marks: on("mark", catalog.marks),
			headings: HEADINGS.filter((level) => value(at.editor(c, "heading", level)) !== false),
		};
		const everything = editor.blocks === "all" && editor.marks === "all" && editor.headings.length === HEADINGS.length;
		if (!everything || saved?.editor) out.editor = editor;
	} else if (saved?.editor) out.editor = saved.editor;
	// The list's columns are the list's to keep (doc 06, `list.savePrefs`); a renamed field keeps its place there.
	if (saved?.list) {
		const renamed = (ids?: string[]) => ids?.map((id) => names.get(id) ?? id);
		out.list = { ...saved.list, order: renamed(saved.list.order), hidden: renamed(saved.list.hidden) };
		if (!out.list.order) delete out.list.order;
		if (!out.list.hidden) delete out.list.hidden;
	}
	return out;
}

/** The layout under the fields' names now: removed fields leave it, and fields it does not hold yet join its first tab. */
function fullLayout(layout: Layout, keys: string[], names: Map<string, string>): Layout {
	const placed = new Set<string>();
	const name = (key: string) => {
		placed.add(key);
		return names.get(key);
	};
	const tabs = layout.map((tab) => ({
		tab: tab.tab,
		fields: tab.fields.flatMap((entry): LayoutField[] => {
			if (typeof entry === "string") {
				const shown = name(entry);
				return shown ? [shown] : [];
			}
			return [{ group: entry.group, fields: entry.fields.flatMap((key) => name(key) ?? []) }];
		}),
	}));
	const rest = keys.filter((key) => !placed.has(key) && names.has(key)).map((key) => names.get(key) as string);
	if (tabs[0]) tabs[0].fields.push(...rest);
	return tabs;
}

/** The layout the fields tab draws: the saved or drafted one, with every field of the draft in it (new ones at the end of the first tab). */
export function shownLayout(layout: Layout | undefined, keys: string[], defaultTab: string): Layout {
	const tabs: Layout = (layout ?? [{ tab: defaultTab, fields: [] }]).map((tab) => ({
		tab: tab.tab,
		fields: tab.fields.map((entry) =>
			typeof entry === "string" ? entry : { group: entry.group, fields: [...entry.fields] },
		),
	}));
	const placed = new Set(
		tabs.flatMap((tab) => tab.fields.flatMap((entry) => (typeof entry === "string" ? [entry] : entry.fields))),
	);
	const first = tabs[0] as Layout[number];
	for (const key of keys) if (!placed.has(key)) first.fields.push(key);
	// A layout may name a field the schema no longer has (doc 01: ignored).
	return tabs.map((tab) => ({
		tab: tab.tab,
		fields: tab.fields.flatMap((entry): LayoutField[] =>
			typeof entry === "string"
				? keys.includes(entry)
					? [entry]
					: []
				: [{ group: entry.group, fields: entry.fields.filter((key) => keys.includes(key)) }],
		),
	}));
}

/**
 * The places an assistant's `schema.apply` writes, read against the saved schema: the collections it adds or deletes, the addresses it changes, the
 * fields it adds, renames, changes or removes, and the labels it gives what it makes.
 */
export function proposalPaths(
	read: SchemaRead,
	input: { draft?: Schema; renames?: Rename[]; adminValues?: Record<string, AdminValues> },
): Record<Path, unknown> {
	const out: Record<Path, unknown> = {};
	const draft = input.draft;
	if (!draft) return out;
	const renames = input.renames ?? [];
	const labels = (c: string, key: string, name: string) => {
		for (const each of FIELD_VALUES) {
			const v = input.adminValues?.[c]?.fields?.[name]?.[each];
			if (v !== undefined) out[at.fieldValue(c, key, each)] = v;
		}
	};
	for (const [c, collection] of Object.entries(draft.collections)) {
		const before = read.schema.collections[c];
		if (!before) {
			out[at.collection(c)] = { kind: collection.kind };
			out[at.path(c)] = collection.path;
			const label = input.adminValues?.[c]?.label;
			if (label) out[at.collectionValue(c, "label")] = label;
			for (const [name, def] of Object.entries(collection.fields)) {
				out[at.field(c, name)] = { name, def } satisfies DraftField;
				labels(c, name, name);
			}
			continue;
		}
		if (before.path !== collection.path) out[at.path(c)] = collection.path;
		const renamedTo = new Map(renames.filter((r) => r.collection === c).map((r) => [r.from, r.to]));
		for (const [name, def] of Object.entries(before.fields)) {
			const to = renamedTo.get(name);
			const next = to ? collection.fields[to] : collection.fields[name];
			if (!next) out[at.field(c, name)] = null;
			else if (to || !sameJson(next, def))
				out[at.field(c, name)] = { name: to ?? name, def: next } satisfies DraftField;
		}
		const targets = new Set(renamedTo.values());
		for (const [name, def] of Object.entries(collection.fields)) {
			if (before.fields[name] || targets.has(name)) continue;
			out[at.field(c, name)] = { name, def } satisfies DraftField;
			labels(c, name, name);
		}
	}
	for (const c of Object.keys(read.schema.collections)) if (!draft.collections[c]) out[at.collection(c)] = null;
	return out;
}

/** The admin values as saved, without their version: what the draft's are compared with. */
export const savedValues = (read: SchemaRead, c: string): AdminValues => {
	const { version: _version, ...values } = read.adminValues[c] ?? { version: 0 };
	return values;
};
