/**
 * The schema file as the settings screen edits it: plain data, changed by small pure functions that return a new copy. Key order is part of the file, so every
 * helper keeps it: a renamed key stays where it was, a new property goes where the format puts it (see `FIELD_KEY_ORDER`), and moving is an explicit step.
 */

import { type Field, IssueList, type PluginFieldSet, TITLE_ROLE } from "@monti-cms/core";
import {
	type CollectionKind,
	checkField,
	checkPathPattern,
	DEFAULT_TITLE_FIELD,
	defaultCollectionPath,
	fieldTraits,
	freshSetFields,
	kindDefaults,
	NAME_PATTERN,
	RESERVED_COLLECTION_NAMES,
	RESERVED_METADATA_KEYS,
} from "@monti-cms/core/site";
import { moveWithin } from "../../lib/utils/move-within";

export type Obj = Record<string, unknown>;

export const isObj = (value: unknown): value is Obj =>
	typeof value === "object" && value !== null && !Array.isArray(value);

export const FIELD_KINDS = ["text", "slug", "relation", "select", "media", "conditional", "backlink", "view"] as const;
export type FieldKindName = (typeof FIELD_KINDS)[number];
/** The kinds a conditional field can show (the ones that store one value). */
export const VALUE_KINDS = ["text", "relation", "select", "media"] as const;

/** The order a field's properties are written in: the common ones, then the ones of the kind (the order of the field format in `format.ts` of core). */
export const FIELD_KEY_ORDER = [
	"kind",
	"label",
	"description",
	"required",
	"localized",
	"input",
	"inputOptions",
	"role",
	"fillFromBody",
	"multiline",
	"rows",
	"max",
	"from",
	"to",
	"many",
	"createInline",
	"publishedOnly",
	"allowUnpublished",
	"ordered",
	"view",
	"via",
	"accept",
	"options",
	"defaultValue",
	"discriminant",
	"values",
	"placeholder",
] as const;

export const COLLECTION_KEY_ORDER = [
	"label",
	"kind",
	"icon",
	"path",
	"folders",
	"body",
	"defaultTab",
	"fields",
	"layout",
] as const;

/** `obj` with `key` set (or removed when `value` is `undefined`). A new key goes after the last key before it in `order` that is present, else at the end. */
export function setProp(obj: Obj, key: string, value: unknown, order: readonly string[] = []): Obj {
	if (value === undefined) {
		const { [key]: _removed, ...rest } = obj;
		return rest;
	}
	if (key in obj) return { ...obj, [key]: value };
	const at = order.indexOf(key);
	const entries = Object.entries(obj);
	let index = entries.length;
	if (at !== -1) {
		const before = entries.map(([name]) => order.indexOf(name)).filter((position) => position !== -1 && position < at);
		const anchor = before.length > 0 ? Math.max(...before) : -1;
		const position = anchor === -1 ? -1 : entries.findIndex(([name]) => order.indexOf(name) === anchor);
		index = position + 1;
		// A key that comes later in the order than every present known key goes after the known keys, before any unknown ones.
	}
	entries.splice(index, 0, [key, value]);
	return Object.fromEntries(entries);
}

const FILE_KEY_ORDER = [
	"collections",
	"migrations",
	"locales",
	"defaultLocale",
	"timeZone",
	"site",
	"admin",
	"seed",
] as const;
/** Where each key of the `site` and `admin` settings is written when it is new. */
const SECTION_KEY_ORDER = {
	site: ["url", "name", "home", "previewPath", "previewLocaleParam", "localePrefix", "aliases"],
	admin: ["path", "locale", "templates", "translations", "messages"],
} as const;

/** The `site` or `admin` settings of the file (empty when it has none). */
export const sectionOf = (file: Obj, section: "site" | "admin"): Obj => (isObj(file[section]) ? file[section] : {});

/** `file` with one setting of `site` or `admin` set (or removed when `value` is `undefined`); a section left empty is removed. */
export function setSetting(file: Obj, section: "site" | "admin", key: string, value: unknown): Obj {
	const next = setProp(sectionOf(file, section), key, value, SECTION_KEY_ORDER[section]);
	return setProp(file, section, Object.keys(next).length === 0 ? undefined : next, FILE_KEY_ORDER);
}

/** One changed setting of `site` or `admin`: its path (`site.name`) and the value before and after (`undefined` when not set). */
export interface SettingChange {
	readonly path: string;
	readonly from: unknown;
	readonly to: unknown;
}

/** The settings of `site` and `admin` that differ between the saved file and the draft, in the order of the draft. */
export function settingChanges(base: Obj, draft: Obj): SettingChange[] {
	const changes: SettingChange[] = [];
	for (const section of ["site", "admin"] as const) {
		const before = sectionOf(base, section);
		const after = sectionOf(draft, section);
		for (const key of new Set([...Object.keys(after), ...Object.keys(before)])) {
			if (!sameJson(before[key], after[key]))
				changes.push({ path: `${section}.${key}`, from: before[key], to: after[key] });
		}
	}
	return changes;
}

/**
 * How many things differ between the saved file and the draft: each collection that was added, removed or edited, each of the language settings
 * (`locales`, `defaultLocale`, `timeZone`) and each changed `site` or `admin` setting. The number shown as unsaved changes.
 */
export function changeCount(base: Obj, draft: Obj): number {
	const before = collectionsOf(base);
	const after = collectionsOf(draft);
	let count = 0;
	const beforeKeys = Object.keys(before);
	const afterKeys = Object.keys(after);
	const sameNames = beforeKeys.length === afterKeys.length && beforeKeys.every((key) => key in after);
	if (sameNames && !sameJson(beforeKeys, afterKeys)) count += 1;
	for (const name of new Set([...beforeKeys, ...afterKeys])) {
		if (!sameJson(before[name], after[name])) count += 1;
	}
	for (const key of ["locales", "defaultLocale", "timeZone"]) {
		if (!sameJson(base[key], draft[key])) count += 1;
	}
	return count + settingChanges(base, draft).length;
}

/** `record` with the key `from` named `to`, in the same place. */
export function renameKey<T>(record: Record<string, T>, from: string, to: string): Record<string, T> {
	return Object.fromEntries(Object.entries(record).map(([key, value]) => [key === from ? to : key, value]));
}

/** `record` with `key` moved by `delta` places (negative: up). */
export function moveKey<T>(record: Record<string, T>, key: string, delta: number): Record<string, T> {
	const entries = Object.entries(record);
	const from = entries.findIndex(([name]) => name === key);
	return from === -1 ? record : Object.fromEntries(moveWithin(entries, from, from + delta));
}

/** `list` with the item at `index` moved by `delta` places (negative: up). */
export function moveItem<T>(list: readonly T[], index: number, delta: number): T[] {
	return moveWithin(list, index, index + delta);
}

/** Whether two JSON values are the same, key order included. */
export function sameJson(a: unknown, b: unknown): boolean {
	if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length && a.every((item, i) => sameJson(item, b[i]));
	if (isObj(a)) {
		if (!isObj(b)) return false;
		const left = Object.keys(a).filter((key) => a[key] !== undefined);
		const right = Object.keys(b).filter((key) => b[key] !== undefined);
		return left.length === right.length && left.every((key, i) => key === right[i] && sameJson(a[key], b[key]));
	}
	return a === b;
}

type NameProblem = "empty" | "pattern" | "reserved" | "taken" | null;

const nameProblemAgainst = (name: string, taken: readonly string[], reserved: readonly string[]): NameProblem => {
	if (name.trim() === "") return "empty";
	if (!NAME_PATTERN.test(name)) return "pattern";
	if (reserved.includes(name)) return "reserved";
	if (taken.includes(name)) return "taken";
	return null;
};

/** Why `name` cannot be used as a field key (or option / block name) among `taken` names, or `null`. */
export function nameProblem(name: string, taken: readonly string[]): NameProblem {
	return nameProblemAgainst(name, taken, RESERVED_METADATA_KEYS);
}

/** Why `name` cannot be used as a collection name among `taken` names, or `null`. Collections have their own reserved names, not the field-key ones. */
export function collectionNameProblem(name: string, taken: readonly string[]): NameProblem {
	return nameProblemAgainst(name, taken, RESERVED_COLLECTION_NAMES);
}

// ----- the file -----

export const collectionsOf = (file: Obj): Record<string, Obj> =>
	isObj(file.collections) ? (file.collections as Record<string, Obj>) : {};
export const fieldsOf = (collection: Obj): Record<string, Obj> =>
	isObj(collection.fields) ? (collection.fields as Record<string, Obj>) : {};

export function setCollection(file: Obj, name: string, update: (collection: Obj) => Obj): Obj {
	const collections = collectionsOf(file);
	const current = collections[name];
	if (!current) return file;
	return { ...file, collections: { ...collections, [name]: update(current) } };
}

/** The public address a new document collection starts with, from its name. */
export const defaultPath = (id: string): string => (id === "" ? "" : defaultCollectionPath(id));

/** The identifier a display name suggests: lowercase ASCII words joined with `-` ("Blog posts" -> "blog-posts"). Empty when the name has no ASCII letters or digits (Korean). */
export const idFromName = (name: string): string =>
	name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "");

/** Why a public address cannot be used (the file wants a `/` first and `:slug` once), or `null`. Empty is fine: the entries have no public page. */
export function pathProblem(path: string): "slash" | "slug" | null {
	if (path.trim() === "") return null;
	return checkPathPattern(path)?.code ?? null;
}

/**
 * A new collection: every collection needs a title, and a slug is what the public address is made from, so both start in place.
 * On a site with several locales the title is per locale, and a document's slug starts from the source locale's, as init writes them.
 */
export function addCollection(file: Obj, name: string, kind: "document" | "item", path?: string, label?: string): Obj {
	const multiLocale = localesOf(file).length > 1;
	let collection: Obj = {
		label: label?.trim() || name.charAt(0).toUpperCase() + name.slice(1),
		kind,
		fields: {
			title: {
				kind: "text",
				label: "Title",
				required: true,
				...(multiLocale ? { localized: true } : {}),
				role: TITLE_ROLE,
			},
			slug: {
				kind: "slug",
				label: "Slug",
				required: true,
				...(multiLocale && kind === "document" ? { localized: "inherit" } : {}),
				from: "title",
			},
		},
	};
	if (path && path.trim() !== "") collection = setProp(collection, "path", path, COLLECTION_KEY_ORDER);
	return { ...file, collections: { ...collectionsOf(file), [name]: collection } };
}

export function removeCollection(file: Obj, name: string): Obj {
	const { [name]: _removed, ...rest } = collectionsOf(file);
	return { ...file, collections: rest };
}

/** `file` with the collection `name` moved by `delta` places in `collections` (negative: up). */
export function moveCollection(file: Obj, name: string, delta: number): Obj {
	return { ...file, collections: moveKey(collectionsOf(file), name, delta) };
}

/** `file` with its `collections` keys arranged in `newOrder`. */
export function reorderCollections(file: Obj, newOrder: readonly string[]): Obj {
	const collections = collectionsOf(file);
	const reordered: Record<string, Obj> = {};
	for (const name of newOrder) {
		if (name in collections) reordered[name] = collections[name] as Obj;
	}
	for (const [name, col] of Object.entries(collections)) {
		if (!reordered[name]) reordered[name] = col;
	}
	return { ...file, collections: reordered };
}

// ----- fields -----

/** Every name in `fields` or inside a conditional field, for the uniqueness of a new name (the stored values share one namespace). */
export function allFieldNames(collection: Obj): string[] {
	const names: string[] = [];
	for (const [name, field] of Object.entries(fieldsOf(collection))) {
		names.push(name);
		if (field.kind === "conditional" && isObj(field.values)) {
			for (const branch of Object.values(field.values)) if (isObj(branch)) names.push(...Object.keys(branch));
		}
	}
	return names;
}

/** The properties every kind of field can have, so a change of kind keeps what still applies. */
const BASE_KEYS = ["label", "description", "required", "localized", "input", "inputOptions", "role"];
const NO_VALUE_KEYS = ["required", "localized", "input", "inputOptions", "role"];

/** A field of `kind` with the properties it needs. */
export function newField(kind: FieldKindName, label: string, collections: readonly string[] = []): Obj {
	switch (kind) {
		case "text":
			return { kind, label };
		case "slug":
			return { kind, label, from: "title" };
		case "relation":
			return { kind, label, to: collections[0] ?? "" };
		case "select":
			return { kind, label, options: { first: "First" }, defaultValue: "first" };
		case "media":
			return { kind, label };
		case "conditional":
			return {
				kind,
				label,
				discriminant: { kind: "select", label, options: { a: "A", b: "B" }, defaultValue: "a" },
				values: {},
			};
		case "backlink":
			return { kind, label, from: collections[0] ?? "", via: "" };
		case "view":
			return { kind, view: "", label };
	}
}

/** `field` as another kind: the common properties stay (the ones the new kind can have), the rest is the new kind's defaults. */
export function withKind(field: Obj, kind: FieldKindName, collections: readonly string[]): Obj {
	const fresh = newField(kind, typeof field.label === "string" ? field.label : "", collections);
	const kept = Object.fromEntries(
		Object.entries(field).filter(
			([key]) => BASE_KEYS.includes(key) && !(!fieldTraits[kind].entersValue && NO_VALUE_KEYS.includes(key)),
		),
	);
	let result: Obj = fresh;
	for (const [key, value] of Object.entries(kept)) {
		if (key === "kind") continue;
		result = setProp(result, key, value, FIELD_KEY_ORDER);
	}
	return result;
}

/** A rename the writer made, so the review offers it as a rename (see `RenameInput` of the API). */
export type Rename =
	| { kind: "field"; collection: string; from: string; to: string }
	| { kind: "option"; collection: string; field: string; from: string; to: string };

/** Records `from -> to`; a rename of a name that was renamed before extends it, and one that returns to the first name cancels it. */
export function recordRename(renames: readonly Rename[], next: Rename): Rename[] {
	const same = (a: Rename, b: Rename) =>
		a.kind === b.kind &&
		a.collection === b.collection &&
		(a.kind !== "option" || (b.kind === "option" && a.field === b.field));
	const earlier = renames.find((item) => same(item, next) && item.to === next.from);
	const rest = renames.filter((item) => item !== earlier);
	if (!earlier) return [...rest, next];
	if (earlier.from === next.to) return rest;
	return [...rest, { ...next, from: earlier.from }];
}

/** Replaces `from` with `to` (or removes it when `to` is `null`) in the names a collection lists besides its fields: layout groups, a slug's source. */
function rewriteReferences(collection: Obj, from: string, to: string | null): Obj {
	let result = collection;
	if (Array.isArray(result.layout)) {
		const layout = (result.layout as Obj[]).map((group) => ({
			...group,
			fields: (Array.isArray(group.fields) ? (group.fields as string[]) : []).flatMap((name) =>
				name === from ? (to ? [to] : []) : [name],
			),
		}));
		result = { ...result, layout };
	}
	const fields = fieldsOf(result);
	const touched = Object.entries(fields).map(([name, field]) =>
		field.kind === "slug" && field.from === from
			? [name, to ? { ...field, from: to } : (({ from: _from, ...rest }) => rest)(field)]
			: [name, field],
	);
	return { ...result, fields: Object.fromEntries(touched) };
}

/** Where a field lives in a collection: top level, or inside the branch of a conditional field. */
export type FieldPlace = { readonly branch?: { readonly field: string; readonly option: string } };

function updateFields(
	collection: Obj,
	place: FieldPlace,
	update: (fields: Record<string, Obj>) => Record<string, Obj>,
): Obj {
	const fields = fieldsOf(collection);
	if (!place.branch) return { ...collection, fields: update(fields) };
	const holder = fields[place.branch.field];
	if (!holder || !isObj(holder.values)) return collection;
	const values = holder.values as Record<string, Record<string, Obj>>;
	const branch = values[place.branch.option] ?? {};
	return {
		...collection,
		fields: {
			...fields,
			[place.branch.field]: { ...holder, values: { ...values, [place.branch.option]: update(branch) } },
		},
	};
}

export function addField(collection: Obj, place: FieldPlace, name: string, field: Obj): Obj {
	return updateFields(collection, place, (fields) => ({ ...fields, [name]: field }));
}

/** The fields of a plugin's field set added after the others, under names the collection does not use yet. */
export function addFieldSet(collection: Obj, set: Pick<PluginFieldSet, "fields">): Obj {
	const added = freshSetFields(set, fieldsOf(collection)) as Record<string, Obj>;
	return updateFields(collection, {}, (fields) => ({ ...fields, ...added }));
}

export function setField(collection: Obj, place: FieldPlace, name: string, update: (field: Obj) => Obj): Obj {
	return updateFields(collection, place, (fields) => {
		const current = fields[name];
		return current ? { ...fields, [name]: update(current) } : fields;
	});
}

export function removeField(collection: Obj, place: FieldPlace, name: string): Obj {
	const removed = updateFields(collection, place, (fields) => {
		const { [name]: _removed, ...rest } = fields;
		return rest;
	});
	return rewriteReferences(removed, name, null);
}

export function moveField(collection: Obj, place: FieldPlace, name: string, delta: number): Obj {
	return updateFields(collection, place, (fields) => moveKey(fields, name, delta));
}

/** Puts `name` where `over` is (a field dropped on another one of the same list); any other name leaves the list as it is. */
export function reorderField(collection: Obj, place: FieldPlace, name: string, over: string): Obj {
	return updateFields(collection, place, (fields) => {
		const keys = Object.keys(fields);
		const from = keys.indexOf(name);
		const to = keys.indexOf(over);
		return from < 0 || to < 0 || from === to ? fields : moveKey(fields, name, to - from);
	});
}

/**
 * The name of the title field of a collection: the field with the `title` role, else the one named `title` (the file only has it at the top level of `fields`).
 * `undefined` when there is none.
 */
export function titleFieldName(collection: Obj): string | undefined {
	const fields = fieldsOf(collection);
	const byRole = Object.keys(fields).find((name) => fields[name]?.role === TITLE_ROLE);
	if (byRole) return byRole;
	return fields[DEFAULT_TITLE_FIELD]?.kind === "text" ? DEFAULT_TITLE_FIELD : undefined;
}

/** Makes `name` the title field: it gets the `title` role, and the field that had it loses it. */
export function setTitleField(collection: Obj, name: string): Obj {
	const fields = Object.fromEntries(
		Object.entries(fieldsOf(collection)).map(([key, field]) => [
			key,
			key === name
				? setProp(field, "role", TITLE_ROLE, FIELD_KEY_ORDER)
				: field.role === TITLE_ROLE
					? setProp(field, "role", undefined)
					: field,
		]),
	);
	return { ...collection, fields };
}

/**
 * Renames a field. The title field keeps being the title field under its new name: a title found by its name (the default) gets the `title` role, which is
 * what names it from then on.
 */
export function renameField(collection: Obj, place: FieldPlace, from: string, to: string): Obj {
	const renamedTitle =
		!place.branch && titleFieldName(collection) === from && fieldsOf(collection)[from]?.role !== TITLE_ROLE;
	const renamed = rewriteReferences(
		updateFields(collection, place, (fields) => renameKey(fields, from, to)),
		from,
		to,
	);
	return renamedTitle
		? setField(renamed, place, to, (field) => setProp(field, "role", TITLE_ROLE, FIELD_KEY_ORDER))
		: renamed;
}

// ----- select options -----

/** The options of a select field, or of the discriminant of a conditional field. */
export function optionsOf(field: Obj): Record<string, string> {
	const select = field.kind === "conditional" && isObj(field.discriminant) ? field.discriminant : field;
	return isObj(select.options) ? (select.options as Record<string, string>) : {};
}

function updateSelect(field: Obj, update: (select: Obj) => Obj): Obj {
	if (field.kind === "conditional" && isObj(field.discriminant))
		return { ...field, discriminant: update(field.discriminant) };
	return update(field);
}

export function addOption(field: Obj, value: string, label: string): Obj {
	return updateSelect(field, (select) => {
		const options = { ...optionsOf(select), [value]: label };
		const result = setProp(select, "options", options, FIELD_KEY_ORDER);
		return typeof select.defaultValue === "string" && select.defaultValue in options
			? result
			: setProp(result, "defaultValue", value, FIELD_KEY_ORDER);
	});
}

export function setOptionLabel(field: Obj, value: string, label: string): Obj {
	return updateSelect(field, (select) => ({ ...select, options: { ...optionsOf(select), [value]: label } }));
}

export function renameOption(field: Obj, from: string, to: string): Obj {
	const renamed = updateSelect(field, (select) => ({
		...select,
		options: renameKey(optionsOf(select), from, to),
		...(select.defaultValue === from ? { defaultValue: to } : {}),
	}));
	if (renamed.kind === "conditional" && isObj(renamed.values))
		return { ...renamed, values: renameKey(renamed.values as Record<string, unknown>, from, to) };
	return renamed;
}

export function removeOption(field: Obj, value: string): Obj {
	const trimmed = updateSelect(field, (select) => {
		const { [value]: _removed, ...options } = optionsOf(select);
		const first = Object.keys(options)[0];
		return {
			...select,
			options,
			...(select.defaultValue === value && first !== undefined ? { defaultValue: first } : {}),
		};
	});
	if (trimmed.kind === "conditional" && isObj(trimmed.values)) {
		const { [value]: _branch, ...values } = trimmed.values as Record<string, unknown>;
		return { ...trimmed, values };
	}
	return trimmed;
}

export function moveOption(field: Obj, value: string, delta: number): Obj {
	return updateSelect(field, (select) => ({ ...select, options: moveKey(optionsOf(select), value, delta) }));
}

export function setDefaultOption(field: Obj, value: string): Obj {
	return updateSelect(field, (select) => ({ ...select, defaultValue: value }));
}

// ----- body, layout, list -----

export interface Allowed {
	blocks?: string[];
	marks?: string[];
	headings?: number[];
}

/** Whether a collection has a body (the file leaves it out for a document, which has one). */
export const hasBody = (collection: Obj): boolean => {
	const { body } = collection;
	if (typeof body === "boolean") return body;
	if (isObj(body)) return true;
	return kindDefaults(collection.kind as CollectionKind | undefined).body;
};

export const allowedOf = (collection: Obj): Allowed => (isObj(collection.body) ? (collection.body as Allowed) : {});

/** The collection with its body written back: left out when it is the default of the kind and nothing is limited, a flag, or the object form. */
export function withBody(collection: Obj, enabled: boolean, allowed: Allowed): Obj {
	const limits = Object.fromEntries(Object.entries(allowed).filter(([, list]) => Array.isArray(list)));
	const defaultBody = kindDefaults(collection.kind as CollectionKind | undefined).body;
	const body: unknown = !enabled ? false : Object.keys(limits).length > 0 ? limits : defaultBody ? undefined : true;
	// The object form wins over a flag already in the file only when something is limited; an explicit `true` stays as written.
	if (body === undefined && collection.body === true) return collection;
	return setProp(collection, "body", body, COLLECTION_KEY_ORDER);
}

export interface LayoutGroup {
	group?: string;
	fields: string[];
	collapsed?: boolean;
	tab?: string;
}

export function withLayout(collection: Obj, layout: LayoutGroup[]): Obj {
	return setProp(collection, "layout", layout.length > 0 ? layout : undefined, COLLECTION_KEY_ORDER);
}

// ----- locales -----

export interface Locale {
	code: string;
	name: string;
	label?: string;
}
export const localesOf = (file: Obj): Locale[] => (Array.isArray(file.locales) ? (file.locales as Locale[]) : []);

// ----- what a field needs -----

/** The field `name` at `place`, or `undefined`. */
export function fieldAt(collection: Obj, place: FieldPlace, name: string): Obj | undefined {
	if (!place.branch) return fieldsOf(collection)[name];
	const holder = fieldsOf(collection)[place.branch.field];
	const values = holder && isObj(holder.values) ? (holder.values as Record<string, Record<string, Obj>>) : {};
	return values[place.branch.option]?.[name];
}

/** The kinds that cannot be added with a name alone: they open their settings first. */
export const KINDS_WITH_SETTINGS: readonly FieldKindName[] = [
	"conditional",
	"relation",
	"select",
	"slug",
	"backlink",
	"view",
];

export type FieldProblem = "options" | "optionLabel" | "branches" | "target" | "slugFrom" | "backlink" | "view";

/** The rule codes of core that mean the form still lacks a setting, and the problem the form names for each. */
const PROBLEM_OF_CODE: Readonly<Record<string, FieldProblem>> = {
	"options-empty": "options",
	"option-label": "optionLabel",
	"branches-empty": "branches",
	"unknown-collection": "target",
	"slug-source": "slugFrom",
	"backlink-incomplete": "backlink",
	"view-name": "view",
};

/**
 * What is still missing from `field` before it can be added (the settings its kind requires), in the order the form shows them. Empty: it is complete. The rules are
 * core's (`checkField`, the ones `defineSite` applies to the saved file); the form only turns the codes into the names its messages use.
 */
export function fieldProblems(field: Obj, collection: Obj, collectionNames: readonly string[]): FieldProblem[] {
	const list = new IssueList();
	checkField(list, "", "field", field as unknown as Field, {
		collectionNames,
		fields: fieldsOf(collection) as unknown as Record<string, Field>,
		body: hasBody(collection),
	});
	const problems = list.issues.flatMap((issue) => {
		const problem = PROBLEM_OF_CODE[issue.code];
		return problem === undefined ? [] : [problem === "target" && field.kind === "backlink" ? "backlink" : problem];
	});
	// A slug is made from a text field; core lets the address stand alone, the form asks for the source.
	if (field.kind === "slug" && typeof field.from !== "string" && !problems.includes("slugFrom"))
		problems.push("slugFrom");
	return [...new Set(problems)];
}

/**
 * Why a field cannot be deleted, or `null`. The title field is what names every entry; the slug field cannot go while the public address is made from `:slug`.
 * Only top-level fields: the file does not take either of them inside a conditional field.
 */
export function removeBlock(collection: Obj, place: FieldPlace, name: string): "title" | "slug" | null {
	if (place.branch) return null;
	if (titleFieldName(collection) === name) return "title";
	const fields = fieldsOf(collection);
	const slugName = Object.keys(fields).find((key) => fields[key]?.kind === "slug");
	if (slugName === name && typeof collection.path === "string" && collection.path.includes(":slug")) return "slug";
	return null;
}
