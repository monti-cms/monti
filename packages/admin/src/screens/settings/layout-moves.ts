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

/**
 * The fields tab as lists of things that trade places (doc 19, dragging an option's fields): the tab's top level (`TOP`: fields and
 * groups), each group's fields (by the group's id), and each option's fields of a conditional field (`optionList`). A field is in one
 * list; dragging moves it within its list or into another.
 */
export type Lists = Record<string, string[]>;

/** The list of an option's fields: `host` is the conditional field's place in the draft, `option` the option's word now. */
export const optionList = (host: string, option: string) => `o:${host}|${option}`;
export const isOptionList = (list: string | null): list is string => Boolean(list?.startsWith("o:"));
/** The conditional field and the option an option's list is of. */
export function optionOf(list: string): { host: string; option: string } {
	const at = list.indexOf("|");
	return { host: list.slice(2, at), option: list.slice(at + 1) };
}
/** An option's band: the first thing of its list, never dragged, and where a field is dropped into an option that has none. */
export const bandId = (list: string) => `b:${list.slice(2)}`;
export const isBand = (id: string) => id.startsWith("b:");
const listOfBand = (id: string) => `o:${id.slice(2)}`;

/** The top level and the groups of a tab as lists. */
export function listsOf(entries: Entries): Lists {
	const lists: Lists = { [TOP]: entryIds(entries) };
	for (const id of lists[TOP] as string[]) if (isGroup(id)) lists[id] = itemsOf(entries, id);
	return lists;
}

/** The tab's entries the lists make: the top level in order, each group (named as it was in `entries`) with its fields. */
export function entriesOf(lists: Lists, entries: Entries): Entries {
	const ids = entryIds(entries);
	return (lists[TOP] ?? []).flatMap((id): Entries => {
		if (isField(id)) return [id.slice(2)];
		const group = entries[ids.indexOf(id)];
		return group && typeof group !== "string"
			? [{ group: group.group, fields: (lists[id] ?? []).map((field) => field.slice(2)) }]
			: [];
	});
}

/** The list an id is in, or `null`. */
export const listIn = (lists: Lists, id: string): string | null =>
	Object.keys(lists).find((list) => (lists[list] as string[]).includes(id)) ?? null;

/**
 * Where the field in hand goes when it is over `over`: the list and the place in it. Over an option's band, the start of that option; over
 * a group without fields, into the group; over a group with fields (its band), the group's place in the top level; over anything else,
 * that thing's place in its list (after it with `below`). `null` when there is nowhere to go.
 */
function target(lists: Lists, active: string, over: string, below: boolean): { list: string; index: number } | null {
	if (isBand(over)) return { list: listOfBand(over), index: 0 };
	if (isGroup(over)) {
		if (listIn(lists, active) === over) return null;
		if ((lists[over] ?? []).length === 0) return { list: over, index: 0 };
		return { list: TOP, index: (lists[TOP] ?? []).indexOf(over) + (below ? 1 : 0) };
	}
	const list = listIn(lists, over);
	if (list === null) return null;
	return { list, index: (lists[list] as string[]).indexOf(over) + (below ? 1 : 0) };
}

/** The lists with the field in hand moved to the list of the thing it is over, when that is another list; the same lists otherwise. */
export function moveAcross(lists: Lists, active: string, over: string, below: boolean): Lists {
	if (!isField(active) || active === over) return lists;
	const from = listIn(lists, active);
	const to = target(lists, active, over, below);
	if (from === null || to === null || from === to.list || to.index < 0) return lists;
	// A list the lists do not hold yet (an option with no fields) starts here.
	const rest = { ...lists, [from]: (lists[from] as string[]).filter((id) => id !== active) };
	const into = rest[to.list] ?? [];
	return { ...rest, [to.list]: [...into.slice(0, to.index), active, ...into.slice(to.index)] };
}

/** The thing in hand takes the place of the one it is over, in the same list (the others move up or down one). */
export function moveWithin(lists: Lists, active: string, over: string): Lists {
	const list = listIn(lists, active);
	// Over its own option's band, a field goes first.
	const place =
		isBand(over) && list === listOfBand(over) ? 0 : list === null ? -1 : (lists[list] as string[]).indexOf(over);
	if (list === null || place < 0 || (!isBand(over) && listIn(lists, over) !== list)) return lists;
	const items = lists[list] as string[];
	const from = items.indexOf(active);
	if (from === place) return lists;
	const rest = items.filter((id) => id !== active);
	return { ...lists, [list]: [...rest.slice(0, place), active, ...rest.slice(place)] };
}
