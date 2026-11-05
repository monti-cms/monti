import type { Layout } from "./schema-draft";

/**
 * Moving things in the fields tab's layout while they are dragged (list.md, section on dragging): fields, groups and tabs, as ids of their sortable
 * things. A tab's top level is one list (`TOP`: fields and groups); each group's fields are another, named by the group's id.
 */

type Entries = Layout[number]["fields"];
type Entry = Entries[number];

export const TOP = "top";
export const TABS = "tabs";
export const fieldId = (key: string) => `f:${key}`;
export const tabId = (index: number) => `t:${index}`;
export const isField = (id: string) => id.startsWith("f:");
export const isGroup = (id: string) => id.startsWith("g:");
export const isTab = (id: string) => id.startsWith("t:");
export const tabIndex = (id: string) => Number(id.slice(2));

/** The id of each top-level entry: a field's `f:key`, a group's `g:name#n` (the n-th group of that name, so two "New group"s differ). */
export function entryIds(entries: Entries): string[] {
	const seen = new Map<string, number>();
	return entries.map((entry) => {
		if (typeof entry === "string") return fieldId(entry);
		const n = seen.get(entry.group) ?? 0;
		seen.set(entry.group, n + 1);
		return `g:${entry.group}#${n}`;
	});
}

/** The ids of a list, in order: the top level's entries, or a group's fields. */
export function itemsOf(entries: Entries, list: string): string[] {
	const ids = entryIds(entries);
	if (list === TOP) return ids;
	const entry = entries[ids.indexOf(list)];
	return entry && typeof entry !== "string" ? entry.fields.map(fieldId) : [];
}

/** The list an id sits in: `TOP` for a group or a top-level field, the group's id for a field in a group, `null` when it is not in this tab. */
export function listOf(entries: Entries, id: string): string | null {
	const ids = entryIds(entries);
	if (ids.includes(id)) return TOP;
	const at = entries.findIndex((entry) => typeof entry !== "string" && entry.fields.map(fieldId).includes(id));
	return at < 0 ? null : (ids[at] ?? null);
}

function take(entries: Entries, id: string): [Entries, Entry | null] {
	const ids = entryIds(entries);
	const at = ids.indexOf(id);
	if (at >= 0) return [entries.filter((_, index) => index !== at), entries[at] ?? null];
	let found: Entry | null = null;
	const rest = entries.map((entry) => {
		if (typeof entry === "string" || !entry.fields.map(fieldId).includes(id)) return entry;
		found = id.slice(2);
		return { group: entry.group, fields: entry.fields.filter((key) => fieldId(key) !== id) };
	});
	return [rest, found];
}

function put(entries: Entries, list: string, index: number, entry: Entry): Entries {
	if (list === TOP) return [...entries.slice(0, index), entry, ...entries.slice(index)];
	const ids = entryIds(entries);
	return entries.map((each, at) =>
		ids[at] === list && typeof each !== "string" && typeof entry === "string"
			? { group: each.group, fields: [...each.fields.slice(0, index), entry, ...each.fields.slice(index)] }
			: each,
	);
}

/**
 * A field held over a thing of another list joins that list, before it (after it with `below`). Over a group without fields it goes into the group;
 * over a group with fields (its band) it takes the group's place in the top level, unless it is already in that group. Anything else stays.
 */
export function relocate(entries: Entries, active: string, over: string, below: boolean): Entries {
	if (!isField(active) || active === over) return entries;
	const from = listOf(entries, active);
	let to: string | null;
	let index: number;
	if (isGroup(over)) {
		if (from === over) return entries;
		const group = entries[entryIds(entries).indexOf(over)];
		if (group && typeof group !== "string" && group.fields.length === 0) {
			to = over;
			index = 0;
		} else {
			to = TOP;
			index = itemsOf(entries, TOP).indexOf(over) + (below ? 1 : 0);
		}
	} else {
		to = listOf(entries, over);
		index = to === null ? -1 : itemsOf(entries, to).indexOf(over) + (below ? 1 : 0);
	}
	if (from === null || to === null || from === to || index < 0) return entries;
	const [rest, entry] = take(entries, active);
	return entry === null ? entries : put(rest, to, index, entry);
}

/** The thing in hand takes the place of the one it is over, in the same list (the others move up or down one). */
export function reorder(entries: Entries, active: string, over: string): Entries {
	const list = listOf(entries, active);
	if (list === null || list !== listOf(entries, over)) return entries;
	const ids = itemsOf(entries, list);
	const from = ids.indexOf(active);
	const to = ids.indexOf(over);
	if (from === to) return entries;
	const [rest, entry] = take(entries, active);
	return entry === null ? entries : put(rest, list, to, entry);
}

/** A field or group goes from tab `from` to the end of tab `to`. */
export function moveToTab(layout: Layout, from: number, id: string, to: number): Layout {
	const source = layout[from];
	if (!source || !layout[to] || from === to) return layout;
	const [rest, entry] = take(source.fields, id);
	if (entry === null) return layout;
	return layout.map((tab, index) =>
		index === from ? { ...tab, fields: rest } : index === to ? { ...tab, fields: [...tab.fields, entry] } : tab,
	);
}

/** Tab `from` takes the place of tab `to`; the others move one over. */
export function moveTab<T>(list: T[], from: number, to: number): T[] {
	const next = [...list];
	const [moved] = next.splice(from, 1);
	if (moved !== undefined) next.splice(to, 0, moved);
	return next;
}

/** Removes tab `index`; its fields and groups join the end of the first tab that is left. */
export function removeTab(layout: Layout, index: number): Layout {
	const gone = layout[index];
	const rest = layout.filter((_, at) => at !== index);
	const first = rest[0];
	if (!gone || !first) return layout;
	return [{ ...first, fields: [...first.fields, ...gone.fields] }, ...rest.slice(1)];
}
