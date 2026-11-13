import {
	type AdminLanguage,
	type AdminValues,
	type AdminValuesPatch,
	type CollectionDefinition,
	canonical,
	type FieldDefinition,
	fingerprint,
	type GroupField,
	inOptionOrder,
	type LocalesDefinition,
	mergeAdminValues,
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

/** What `settings.read` answers (doc 12): the schema's read and the two rows of admin values the settings screen holds. */
export type SettingsRead = SchemaRead & {
	site: { name: string; writingStyle: string; version: number };
	admin: { language: AdminLanguage | null; templates: boolean; version: number };
};

/** The blocks and marks the site's editor has (`blocks.catalog`), the ones a collection's editor tab turns on and off. */
export type Catalog = {
	blocks: { type: string; label: string | { key: string }; menu: string | null }[];
	marks: { type: string; label: string | { key: string } }[];
};

/**
 * A field as the draft holds it: its name now (a rename changes it) and its definition. Its place in the draft is keyed by the name it came with.
 * A field of a conditional field's option (doc 19) is a field of its own here, as it is stored: `under` says which field (by its place) and which
 * option it belongs to, and the conditional field's own definition holds its options with no fields in them.
 */
export type DraftField = {
	name: string;
	def: FieldDefinition;
	under?: { field: string; option: string };
	/** The options of a select or a conditional field renamed in the draft: the saved word to the word now. The save rewrites the stored word. */
	renamed?: Record<string, string>;
};

/** An option's word now, from the word a field of it names it by (the saved word, or the word now). */
const optionNow = (host: DraftField | null | undefined, option: string) => host?.renamed?.[option] ?? option;

/** The option renames a field holds that are real: the saved field lists the old word, the field now lists the new one and not the old. */
function optionRenames(saved: DraftField | undefined, field: DraftField): [string, string][] {
	const [was, now] = [saved?.def, field.def];
	if (!was || !("options" in was) || !("options" in now)) return [];
	return Object.entries(field.renamed ?? {}).filter(
		([from, to]) => was.options.includes(from) && now.options.includes(to) && !now.options.includes(from),
	);
}

/** A collection's fields as the draft holds them, in the order shown: a conditional field, then its options' fields. */
export function draftFields(collection: Pick<CollectionDefinition, "fields"> | undefined): Record<string, DraftField> {
	const out: Record<string, DraftField> = {};
	const put = (fields: Record<string, FieldDefinition>, under?: DraftField["under"]) => {
		for (const [name, def] of Object.entries(fields)) {
			if (def.kind !== "conditional") {
				out[name] = { name, def, ...(under ? { under } : {}) };
				continue;
			}
			// A conditional field in an option of another is a field of that option, and has options with fields of its own.
			out[name] = { name, def: { ...def, fields: {} }, ...(under ? { under } : {}) };
			for (const option of def.options) put(def.fields[option] ?? {}, { field: name, option });
		}
	};
	put(collection?.fields ?? {});
	return out;
}

/** A field as it is saved, by its place in the draft; `undefined` for a field the draft made. */
export const savedField = (read: SchemaRead, c: string, key: string): DraftField | undefined =>
	draftFields(read.schema.collections[c])[key];

/** The admin values of a field the screen edits. */
export const FIELD_VALUES = ["label", "description", "optionLabels", "optionFields"] as const;
export type FieldValue = (typeof FIELD_VALUES)[number];

/** The heading levels a body can have (doc 03): the editor tab turns each on or off. */
export const HEADINGS = [2, 3, 4] as const;

/**
 * The places of the collections screen's draft. A collection is keyed by its identifier, a field by the name it had when it entered the draft (so a
 * rename keeps its place):
 *
 * - `col:<c>` the collection (`{ kind }`, `null` once deleted) · `path:<c>` its public address · `preview:<c>` its preview page's (doc 16)
 * - `field:<c>:<key>` a field (`DraftField`, `null` once removed)
 * - `ca:<c>:label|folders|layout` the collection's admin values · `fa:<c>:<key>:<value>` a field's
 * - `ed:<c>:block:<type>`, `ed:<c>:mark:<type>`, `ed:<c>:heading:<level>` what its editor allows
 *
 * The site and language tabs share the draft (doc 12):
 *
 * - `site:name`, `site:writingStyle` the site's admin values
 * - `locale:<code>` a language (`{ name }`, `null` once taken out) · `locales:order` the codes in their order · `locales:source` the source
 *   language's code · `locales:prefix` how addresses show the language
 */
export const at = {
	site: (value: "name" | "writingStyle") => `site:${value}`,
	locale: (code: string) => `locale:${code}`,
	localeOrder: "locales:order",
	localeSource: "locales:source",
	localePrefix: "locales:prefix",
	collection: (c: string) => `col:${c}`,
	path: (c: string) => `path:${c}`,
	preview: (c: string) => `preview:${c}`,
	field: (c: string, key: string) => `field:${c}:${key}`,
	collectionValue: (c: string, value: "label" | "folders" | "layout") => `ca:${c}:${value}`,
	fieldValue: (c: string, key: string, value: FieldValue) => `fa:${c}:${key}:${value}`,
	editor: (c: string, what: "block" | "mark" | "heading", name: string | number) => `ed:${c}:${what}:${name}`,
};

/** A path split into what it names. */
export type Place =
	| { kind: "collection"; collection: string }
	| { kind: "path"; collection: string }
	| { kind: "preview"; collection: string }
	| { kind: "field"; collection: string; key: string }
	| { kind: "collectionValue"; collection: string; value: "label" | "folders" | "layout" }
	| { kind: "fieldValue"; collection: string; key: string; value: FieldValue }
	| { kind: "editor"; collection: string; what: "block" | "mark" | "heading"; name: string };

export function placeOf(path: Path): Place | null {
	const [head, collection = "", a = "", b = ""] = path.split(":");
	if (head === "col") return { kind: "collection", collection };
	if (head === "path") return { kind: "path", collection };
	if (head === "preview") return { kind: "preview", collection };
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

/** The settings tab a place belongs to: its dot, and where a row of the changes list goes. */
export function tabOf(path: Path): "site" | "languages" | "collections" {
	if (path.startsWith("site:") || path === at.localePrefix) return "site";
	return path.startsWith("locale:") || path.startsWith("locales:") ? "languages" : "collections";
}

/** A language as the draft holds it: its name written in itself. */
export type DraftLocale = { name: string };

/** One row of the language tab: the saved languages and the ones the draft adds, in the order shown, the source first. */
export type LocaleRow = { code: string; name: string; source: boolean; state: "same" | "added" | "gone" };

/**
 * The languages as the draft has them. `paths` are the places changed or proposed (a new language is only there); `value` reads a place. The source
 * stands first (flow 11, step 07b); a language taken out keeps its row until the save.
 */
export function localeRows(read: SchemaRead, paths: Path[], value: Values): LocaleRow[] {
	const saved = read.schema.locales.list.map((locale) => locale.code);
	const codes = [...saved];
	for (const path of paths)
		if (path.startsWith("locale:") && !codes.includes(path.slice(7)) && value(path)) codes.push(path.slice(7));
	const order = ((value(at.localeOrder) as string[] | undefined) ?? saved).filter((code) => codes.includes(code));
	const ordered = [...order, ...codes.filter((code) => !order.includes(code))];
	const source = String(value(at.localeSource) ?? read.schema.locales.source);
	return [...ordered.filter((code) => code === source), ...ordered.filter((code) => code !== source)].map((code) => {
		const locale = value(at.locale(code)) as DraftLocale | null | undefined;
		const before = read.schema.locales.list.find((each) => each.code === code);
		return {
			code,
			name: locale?.name ?? before?.name ?? code,
			source: code === source,
			state: !locale ? "gone" : before ? "same" : "added",
		};
	});
}

/** The languages the draft makes: the rows still there, in order, with the source and the way addresses show the language. */
export function buildLocales(read: SchemaRead, paths: Path[], value: Values): LocalesDefinition {
	const rows = localeRows(read, paths, value).filter((row) => row.state !== "gone");
	return {
		source: rows.find((row) => row.source)?.code ?? read.schema.locales.source,
		list: rows.map((row) => ({ code: row.code, name: row.name })),
		prefix: (value(at.localePrefix) as LocalesDefinition["prefix"] | undefined) ?? read.schema.locales.prefix,
	};
}

/** The places a proposed set of languages writes, read against the saved one: languages added and taken out, the source, the order, the prefix. */
export function localeProposalPaths(read: SchemaRead, locales: LocalesDefinition | undefined): Record<Path, unknown> {
	const out: Record<Path, unknown> = {};
	if (!locales) return out;
	const saved = read.schema.locales;
	const had = saved.list.map((locale) => locale.code);
	const has = locales.list.map((locale) => locale.code);
	for (const locale of locales.list)
		if (!had.includes(locale.code)) out[at.locale(locale.code)] = { name: locale.name } satisfies DraftLocale;
	for (const code of had) if (!has.includes(code)) out[at.locale(code)] = null;
	if (locales.source !== saved.source) out[at.localeSource] = locales.source;
	if (locales.prefix !== saved.prefix) out[at.localePrefix] = locales.prefix;
	// The order counts only among the languages both have: a new one at the end is no reordering.
	const kept = (codes: string[], other: string[]) => codes.filter((code) => other.includes(code));
	if (!sameJson(kept(has, had), kept(had, has))) out[at.localeOrder] = has;
	return out;
}

/** A collection's preview page address: a document's, when the site made such a page (doc 16). */
const previewOf = (collection: Schema["collections"][string]) =>
	collection.kind === "document" ? (collection.previewPath ?? null) : null;

/** The saved values, flattened to the draft's places. */
export function flatten(read: SchemaRead | SettingsRead, catalog: Catalog | null): Record<Path, unknown> {
	const base: Record<Path, unknown> = {};
	if ("site" in read) {
		base[at.site("name")] = read.site.name;
		base[at.site("writingStyle")] = read.site.writingStyle;
	}
	for (const locale of read.schema.locales.list)
		base[at.locale(locale.code)] = { name: locale.name } satisfies DraftLocale;
	base[at.localeOrder] = read.schema.locales.list.map((locale) => locale.code);
	base[at.localeSource] = read.schema.locales.source;
	base[at.localePrefix] = read.schema.locales.prefix;
	for (const [c, collection] of Object.entries(read.schema.collections)) {
		base[at.collection(c)] = { kind: collection.kind };
		base[at.path(c)] = collection.path ?? null;
		base[at.preview(c)] = previewOf(collection);
		for (const [name, field] of Object.entries(draftFields(collection))) base[at.field(c, name)] = field;
		Object.assign(base, adminPlaces(c, collection, read.adminValues[c], catalog));
	}
	return base;
}

/** A collection's admin values at the draft's places: its own (`ca:`), each field's (`fa:`) and what its editor allows (`ed:`). */
function adminPlaces(
	c: string,
	collection: CollectionDefinition,
	values: AdminValues | undefined,
	catalog: Catalog | null,
): Record<Path, unknown> {
	const places: Record<Path, unknown> = {};
	places[at.collectionValue(c, "label")] = values?.label;
	places[at.collectionValue(c, "folders")] = values?.folders ?? false;
	places[at.collectionValue(c, "layout")] = values?.layout;
	for (const name of Object.keys(draftFields(collection)))
		for (const value of FIELD_VALUES) places[at.fieldValue(c, name, value)] = values?.fields?.[name]?.[value];
	if (collection.kind === "document" && catalog) {
		const editor = values?.editor;
		for (const block of listedBlocks(catalog))
			places[at.editor(c, "block", block.type)] = allows(editor?.blocks, block.type);
		for (const mark of catalog.marks) places[at.editor(c, "mark", mark.type)] = allows(editor?.marks, mark.type);
		for (const level of HEADINGS)
			places[at.editor(c, "heading", level)] = editor?.headings ? editor.headings.includes(level) : true;
	}
	return places;
}

/**
 * The places a proposed change of a collection's admin values writes: what the patch the assistant gave turns the saved values into, where that
 * differs from them (a label, a field's help, the layout, what the editor allows). Only the keys it names: the rest stay as saved (doc 12). The
 * proposal names fields as its own draft does; `renames` (of the same proposal) say which saved field each is, since the draft's places are keyed
 * by the saved names.
 */
export function adminValueProposalPaths(
	read: SchemaRead,
	catalog: Catalog | null,
	c: string,
	patch: AdminValuesPatch,
	renames: Rename[] = [],
): Record<Path, unknown> {
	const collection = read.schema.collections[c];
	if (!collection) return {};
	const savedName = new Map(renames.filter((rename) => rename.collection === c).map((r) => [r.to, r.from]));
	const key = (name: string) => savedName.get(name) ?? name;
	const underSavedNames: AdminValuesPatch = {
		...patch,
		...(patch.fields
			? { fields: Object.fromEntries(Object.entries(patch.fields).map(([name, value]) => [key(name), value])) }
			: {}),
		...(patch.layout
			? {
					layout: patch.layout.map((tab) => ({
						tab: tab.tab,
						fields: tab.fields.map((each) =>
							typeof each === "string" ? key(each) : { group: each.group, fields: each.fields.map(key) },
						),
					})),
				}
			: {}),
	};
	const proposed = adminPlaces(c, collection, mergeAdminValues(savedValues(read, c), underSavedNames), catalog);
	const saved = adminPlaces(c, collection, read.adminValues[c], catalog);
	return Object.fromEntries(Object.entries(proposed).filter(([path, value]) => !sameJson(value, saved[path])));
}

/**
 * What the settings draft is a draft of, as one fingerprint: the site's values, the schema and each collection's admin values that the screen
 * edits. The changes this browser kept come back while it is the same (doc 05). The lists' own look (a column width dragged in a list) is not the
 * settings', so it is left out: it must not throw the kept changes away.
 */
export function settingsVersion(read: SettingsRead): string {
	// The draft's own places as they are saved (`flatten`): a collection with no admin values, one whose only values are the list's, and one
	// with a value left at what it is by default (folders off) are all the same places, so they are the same version.
	const places = flatten(read, null);
	// What a collection's editor allows becomes places only once the site's blocks are known; here it is taken as saved.
	const editors = Object.fromEntries(
		Object.entries(read.adminValues).flatMap(([c, values]) =>
			values.editor && Object.keys(values.editor).length > 0 ? [[c, values.editor]] : [],
		),
	);
	return fingerprint(JSON.stringify(canonical({ places, editors })));
}

/** Whether a place holds an admin value of a collection (its own, a field's, the editor's), as against its structure. */
export const isAdminPlace = (path: Path) => /^(ca|fa|ed):/.test(path);

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
	const keys = Object.keys(draftFields(read.schema.collections[c]));
	for (const path of changed) {
		const place = placeOf(path);
		if (place?.kind === "field" && place.collection === c && !keys.includes(place.key)) keys.push(place.key);
	}
	return keys;
}

/**
 * The fields of a conditional field's option, by their places: those the draft still has, in the order shown. `host` is the conditional field's
 * place.
 */
export function optionFields(keys: string[], value: Values, c: string, host: string, option: string): string[] {
	const hostField = value(at.field(c, host)) as DraftField | null | undefined;
	const theirs = keys.filter((key) => {
		const field = value(at.field(c, key)) as DraftField | null | undefined;
		return field?.under?.field === host && optionNow(hostField, field.under.option) === option;
	});
	// The order the conditional field keeps for the option (by the fields' places), then the rest as the schema has them.
	const order = value(at.fieldValue(c, host, "optionFields")) as Record<string, string[]> | undefined;
	return inOptionOrder(theirs, order?.[option]);
}

/** The option a field of `host` is under, as the draft names it: the word the option was saved with (`DraftField.under`), from its word now. */
export function savedOption(host: DraftField | null | undefined, option: string): string {
	return Object.entries(host?.renamed ?? {}).find(([, now]) => now === option)?.[0] ?? option;
}

/** Whether the field at `key` hangs under the field at `host`, however deep: a conditional field cannot be put into its own options. */
export function isUnder(value: Values, c: string, key: string, host: string): boolean {
	for (let at_ = key, steps = 0; steps < 32; steps++) {
		const field = value(at.field(c, at_)) as DraftField | null | undefined;
		if (!field?.under) return false;
		if (field.under.field === host) return true;
		at_ = field.under.field;
	}
	return false;
}

/** Whether the field at a place stands in the list on its own: not a field of an option. A removed field is judged by what it was. */
export function isTopField(read: SchemaRead, value: Values, c: string, key: string): boolean {
	const field = (value(at.field(c, key)) ?? savedField(read, c, key)) as DraftField | undefined;
	return !field?.under;
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
	const schema: Schema = { locales: buildLocales(read, changed, value), collections: {} };
	const renames: Rename[] = [];
	const adminValues: Record<string, AdminValues> = {};
	for (const c of collectionKeys(read, changed)) {
		const collection = value(at.collection(c)) as { kind: CollectionDefinition["kind"] } | null | undefined;
		if (!collection) continue;
		const fields: Record<string, FieldDefinition> = {};
		const names = new Map<string, string>();
		const keys = fieldKeys(read, changed, c);
		const drafted = keys.flatMap((key) => {
			const field = value(at.field(c, key)) as DraftField | null | undefined;
			return field ? [[key, field] as const] : [];
		});
		// A conditional field's options' fields, by the conditional field's place: put into its definition under each option still listed.
		const groups = new Map<string, Record<string, Record<string, GroupField>>>();
		const made = new Map<string, FieldDefinition>();
		for (const [key, field] of drafted) {
			made.set(key, field.def.kind === "conditional" ? { ...field.def, fields: {} } : field.def);
			if (field.def.kind === "conditional")
				groups.set(key, Object.fromEntries(field.def.options.map((option) => [option, {}])));
		}
		for (const [key, field] of drafted) {
			if (field.under) continue;
			fields[field.name] = made.get(key) as FieldDefinition;
			names.set(key, field.name);
		}
		// A field of an option goes in once its conditional field is in (it may itself stand in an option of another), in the order the
		// conditional field keeps for the option. A field of an option that is gone, or of a conditional field that is, goes with it: the
		// review asks about its values.
		const waiting = new Set(drafted.filter(([, field]) => field.under).map(([key]) => key));
		const byKey = new Map(drafted);
		for (let placed = true; placed; ) {
			placed = false;
			for (const [host, options] of groups) {
				if (!names.has(host)) continue;
				const hostField = byKey.get(host);
				const order = value(at.fieldValue(c, host, "optionFields")) as Record<string, string[]> | undefined;
				for (const option of Object.keys(options)) {
					const theirs = [...waiting].filter((key) => {
						const under = byKey.get(key)?.under;
						return under?.field === host && optionNow(hostField, under.option) === option;
					});
					for (const key of inOptionOrder(theirs, order?.[option])) {
						(options[option] as Record<string, GroupField>)[(byKey.get(key) as DraftField).name] = made.get(
							key,
						) as GroupField;
						names.set(key, (byKey.get(key) as DraftField).name);
						waiting.delete(key);
						placed = true;
					}
				}
			}
		}
		for (const [host, options] of groups) {
			const definition = made.get(host);
			if (definition?.kind === "conditional")
				definition.fields = Object.fromEntries(
					Object.entries(options).filter(([, group]) => Object.keys(group).length > 0),
				);
		}
		for (const [key, name] of names)
			if (savedField(read, c, key) && name !== key) renames.push({ collection: c, from: key, to: name });
		for (const [key, field] of drafted)
			if (names.has(key))
				for (const [from, to] of optionRenames(savedField(read, c, key), field))
					renames.push({ collection: c, of: field.name, from, to });
		const path = value(at.path(c));
		const preview = value(at.preview(c));
		schema.collections[c] =
			collection.kind === "document"
				? {
						kind: "document",
						path: typeof path === "string" ? path : "",
						...(typeof preview === "string" ? { previewPath: preview } : {}),
						fields,
					}
				: { kind: "item", ...(typeof path === "string" ? { path } : {}), fields };
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
			if (v === undefined || v === "") continue;
			// The order of an option's fields is kept by their places: saved, it names them as they are named now.
			one[each] =
				each === "optionFields"
					? Object.fromEntries(
							Object.entries(v as Record<string, string[]>).map(([option, keys]) => [
								option,
								keys.flatMap((inner) => names.get(inner) ?? []),
							]),
						)
					: v;
		}
		if (Object.keys(one).length > 0) fields[name] = one;
	}
	if (Object.keys(fields).length > 0) out.fields = fields;
	const layout = value(at.collectionValue(c, "layout")) as Layout | undefined;
	// The layout places the fields that stand on their own; an option's fields go where their conditional field is (doc 19).
	const top = keys.filter((key) => isTopField(read, value, c, key));
	if (layout) out.layout = fullLayout(layout, top, names);
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
	// The list's own look (its columns, their widths) is the list's to keep (doc 06, `list.savePrefs`): the draft does not hold it, and the save
	// names nothing of it. A renamed field keeps its place there by the structure change itself.
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
	input: { draft?: Schema; renames?: Rename[]; adminValues?: Record<string, AdminValuesPatch> },
): Record<Path, unknown> {
	const draft = input.draft;
	if (!draft) return {};
	const out: Record<Path, unknown> = localeProposalPaths(read, draft.locales);
	const renames = input.renames ?? [];
	const labels = (c: string, key: string, name: string) => {
		for (const each of FIELD_VALUES) {
			const v = input.adminValues?.[c]?.fields?.[name]?.[each];
			if (v !== undefined && v !== null) out[at.fieldValue(c, key, each)] = v;
		}
	};
	for (const [c, collection] of Object.entries(draft.collections)) {
		const before = read.schema.collections[c];
		if (!before) {
			out[at.collection(c)] = { kind: collection.kind };
			out[at.path(c)] = collection.path ?? null;
			out[at.preview(c)] = previewOf(collection);
			const label = input.adminValues?.[c]?.label;
			if (label) out[at.collectionValue(c, "label")] = label;
			for (const [name, field] of Object.entries(draftFields(collection))) {
				out[at.field(c, name)] = field;
				labels(c, name, name);
			}
			continue;
		}
		if (before.path !== collection.path) out[at.path(c)] = collection.path ?? null;
		if (previewOf(before) !== previewOf(collection)) out[at.preview(c)] = previewOf(collection);
		const renamedTo = new Map(renames.filter((r) => r.collection === c && !r.of).map((r) => [r.from, r.to]));
		const savedName = new Map([...renamedTo].map(([from, to]) => [to, from]));
		const ofField = (name: string) => renames.filter((r) => r.collection === c && r.of === name);
		// A field of an option names its conditional field by that field's place (the name it was saved with) and its option by the saved
		// word; a field with renamed options carries them.
		const placed = (field: DraftField): DraftField => {
			const options = ofField(field.name);
			const out: DraftField =
				options.length > 0
					? { ...field, renamed: Object.fromEntries(options.map((rename) => [rename.from, rename.to])) }
					: field;
			if (!out.under) return out;
			const word = ofField(out.under.field).find((rename) => rename.to === out.under?.option)?.from;
			return {
				...out,
				under: { field: savedName.get(out.under.field) ?? out.under.field, option: word ?? out.under.option },
			};
		};
		const [was, now] = [draftFields(before), draftFields(collection)];
		for (const [name, field] of Object.entries(was)) {
			const to = renamedTo.get(name);
			const found = now[to ?? name];
			const next = found ? placed(found) : undefined;
			if (!next) out[at.field(c, name)] = null;
			else if (to || !sameJson(next, field)) out[at.field(c, name)] = next;
		}
		const targets = new Set(renamedTo.values());
		for (const [name, field] of Object.entries(now)) {
			if (was[name] || targets.has(name)) continue;
			out[at.field(c, name)] = placed(field);
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
