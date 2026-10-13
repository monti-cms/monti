import { fieldsOf, layoutOf, type Obj, setProp, titleFieldName, withLayout } from "./schema-model";

/**
 * The properties panel of the edit screen as the fields tree shows it: tab, then group, then field. The tree is the one source of truth: saving it writes the order
 * of `fields` and `layout` together, so the two cannot disagree, and reading what was saved gives the same tree back.
 *
 * It follows `layoutGroupsOf` (the rules of the real panel):
 * - a `layout` group sits in its `tab`, or in the default tab; a group without a title only gathers fields into its tab, so those fields are "in no group";
 * - fields in no group come after the last group of their tab;
 * - a field with a `tab` of its own (placed by a plugin) is drawn in that tab, whatever the layout says: it is locked there;
 * - the title field and `hidden` fields are not drawn in the panel: they are pinned and never join a group.
 */
export interface Group {
	title: string;
	collapsed?: boolean;
	fields: string[];
}

export interface Tab {
	name: string;
	groups: Group[];
	/** Fields in no group of this tab, after its last group. */
	ungrouped: string[];
	/** Fields a plugin placed in this tab (their `tab`): shown here, never movable. */
	locked: string[];
}

export interface Tree {
	/** Fields the panel does not draw (the title, `hidden` fields): they only define the order of `fields`. */
	pinned: string[];
	/** The default tab first, then the others in the order the panel shows them. */
	tabs: Tab[];
}

export type NoPanelReason = "title" | "hidden";

/** Why the panel does not draw a top-level field, or `null` when it does. */
export function noPanelReason(collection: Obj, name: string): NoPanelReason | null {
	const field = fieldsOf(collection)[name];
	if (!field) return null;
	if (titleFieldName(collection) === name) return "title";
	return field.kind !== "conditional" && field.hidden === true ? "hidden" : null;
}

/** The own tab of a field a plugin placed, or `undefined`. */
export const ownTabOf = (collection: Obj, name: string): string | undefined => {
	const tab = fieldsOf(collection)[name]?.tab;
	return typeof tab === "string" && tab !== "" ? tab : undefined;
};

/** Where a field is in the tree. */
export interface Place {
	tab: number;
	/** Index of the group in the tab, or `null` for the fields in no group. */
	group: number | null;
	index: number;
}

export interface GroupRef {
	tab: number;
	index: number;
}

const copy = (tree: Tree): Tree => structuredClone(tree);

const tabOfName = (tree: Tree, name: string, defaultTab: string): number => {
	const at = tree.tabs.findIndex((tab) => tab.name === name);
	return at === -1 ? tree.tabs.findIndex((tab) => tab.name === defaultTab) : at;
};

/** The tree of a collection. `defaultTab` is the name of the panel's first tab. */
export function treeOf(collection: Obj, defaultTab: string): Tree {
	const names = Object.keys(fieldsOf(collection));
	const pinned = names.filter((name) => noPanelReason(collection, name) !== null);
	const locked = (name: string) => !pinned.includes(name) && ownTabOf(collection, name) !== undefined;
	const tree: Tree = { pinned, tabs: [{ name: defaultTab, groups: [], ungrouped: [], locked: [] }] };
	const tab = (name: string): Tab => {
		const found = tree.tabs.find((item) => item.name === name);
		if (found) return found;
		const created: Tab = { name, groups: [], ungrouped: [], locked: [] };
		tree.tabs.push(created);
		return created;
	};
	const placed = new Set<string>();
	for (const group of layoutOf(collection)) {
		const target = tab(group.tab && group.tab !== "" ? group.tab : defaultTab);
		const fields = group.fields.filter((name) => {
			if (!names.includes(name) || placed.has(name) || pinned.includes(name) || locked(name)) return false;
			placed.add(name);
			return true;
		});
		if (group.group) {
			target.groups.push({ title: group.group, ...(group.collapsed === true ? { collapsed: true } : {}), fields });
		} else {
			target.ungrouped.push(...fields);
		}
	}
	for (const name of names) {
		if (pinned.includes(name)) continue;
		const own = ownTabOf(collection, name);
		if (own !== undefined) tab(own).locked.push(name);
		else if (!placed.has(name)) (tree.tabs[0] as Tab).ungrouped.push(name);
	}
	return tree;
}

/** The collection with its fields in the order of the tree and its `layout` the tree's groups (none when the tree is only the default tab's fields). */
export function withTree(collection: Obj, tree: Tree): Obj {
	const fields = fieldsOf(collection);
	const order = [
		...tree.pinned,
		...tree.tabs.flatMap((tab) => [...tab.groups.flatMap((group) => group.fields), ...tab.ungrouped, ...tab.locked]),
	].filter((name, at, all) => name in fields && all.indexOf(name) === at);
	const rest = Object.keys(fields).filter((name) => !order.includes(name));
	const ordered = Object.fromEntries([...order, ...rest].map((name) => [name, fields[name] as Obj]));
	const layout = tree.tabs.flatMap((tab, at) => {
		const tabKey = at === 0 ? {} : { tab: tab.name };
		const groups = tab.groups.map((group) => ({
			group: group.title,
			fields: group.fields,
			...tabKey,
			...(group.collapsed === true ? { collapsed: true } : {}),
		}));
		// A tab other than the default one exists in the file through its groups: the fields in no group (even none) go into one group without a title.
		return at === 0 ? groups : [...groups, { fields: tab.ungrouped, ...tabKey }];
	});
	return withLayout(setProp(collection, "fields", ordered), layout);
}

export function placeOf(tree: Tree, name: string): Place | null {
	for (const [tab, node] of tree.tabs.entries()) {
		for (const [group, item] of node.groups.entries()) {
			const index = item.fields.indexOf(name);
			if (index !== -1) return { tab, group, index };
		}
		const index = node.ungrouped.indexOf(name);
		if (index !== -1) return { tab, group: null, index };
	}
	return null;
}

const listAt = (tree: Tree, tab: number, group: number | null): string[] | null => {
	const node = tree.tabs[tab];
	if (!node) return null;
	return group === null ? node.ungrouped : (node.groups[group]?.fields ?? null);
};

/** Puts the field at `position` of a group (or of the fields in no group of a tab); the end when omitted. A locked or pinned field does not move. */
export function placeField(tree: Tree, name: string, tab: number, group: number | null, position?: number): Tree {
	const next = copy(tree);
	const from = placeOf(next, name);
	const target = listAt(next, tab, group);
	if (!from || !target) return next;
	(listAt(next, from.tab, from.group) as string[]).splice(from.index, 1);
	target.splice(position === undefined ? target.length : Math.min(position, target.length), 0, name);
	return next;
}

/** Drops a field on another field: it takes that field's place. */
export function dropFieldOnField(tree: Tree, name: string, over: string): Tree {
	const at = placeOf(tree, over);
	if (!at || name === over) return copy(tree);
	return placeField(tree, name, at.tab, at.group, at.index);
}

/** One step up or down the list as the tree shows it; past the end of a group the field moves into the neighbouring one, across tabs. */
export function moveFieldBy(tree: Tree, name: string, delta: -1 | 1): Tree {
	const from = placeOf(tree, name);
	if (!from) return copy(tree);
	const list = listAt(tree, from.tab, from.group) as string[];
	const to = from.index + delta;
	if (to >= 0 && to < list.length) return placeField(tree, name, from.tab, from.group, to);
	// The containers in the order they are drawn.
	const containers = tree.tabs.flatMap((tab, t) => [
		...tab.groups.map((_, g) => ({ tab: t, group: g as number | null })),
		{ tab: t, group: null as number | null },
	]);
	const here = containers.findIndex((item) => item.tab === from.tab && item.group === from.group);
	const next = containers[here + delta];
	if (!next) return copy(tree);
	return placeField(tree, name, next.tab, next.group, delta < 0 ? undefined : 0);
}

export function addGroup(tree: Tree, tab: number, title: string): Tree {
	const next = copy(tree);
	next.tabs[tab]?.groups.push({ title, fields: [] });
	return next;
}

export function editGroup(tree: Tree, ref: GroupRef, patch: { title?: string; collapsed?: boolean }): Tree {
	const next = copy(tree);
	const group = next.tabs[ref.tab]?.groups[ref.index];
	if (!group) return next;
	if (patch.title !== undefined && patch.title.trim() !== "") group.title = patch.title.trim();
	if (patch.collapsed !== undefined) {
		if (patch.collapsed) group.collapsed = true;
		else delete group.collapsed;
	}
	return next;
}

/** Removes a group; its fields go to the front of the fields in no group of its tab. */
export function removeGroup(tree: Tree, ref: GroupRef): Tree {
	const next = copy(tree);
	const tab = next.tabs[ref.tab];
	const removed = tab?.groups[ref.index];
	if (!tab || !removed) return next;
	tab.groups.splice(ref.index, 1);
	tab.ungrouped.unshift(...removed.fields);
	return next;
}

/** Moves a group (with its fields) to the place of another group, in its tab or in another one; `to.index` past the last group means the end. */
export function moveGroup(tree: Tree, from: GroupRef, to: GroupRef): Tree {
	const next = copy(tree);
	const [moved] = next.tabs[from.tab]?.groups.splice(from.index, 1) ?? [];
	const target = next.tabs[to.tab];
	if (!moved || !target) return copy(tree);
	target.groups.splice(Math.min(to.index, target.groups.length), 0, moved);
	return next;
}

/** One step among the groups of the tab. */
export function moveGroupBy(tree: Tree, ref: GroupRef, delta: -1 | 1): Tree {
	const count = tree.tabs[ref.tab]?.groups.length ?? 0;
	const to = ref.index + delta;
	return to < 0 || to >= count ? copy(tree) : moveGroup(tree, ref, { tab: ref.tab, index: to });
}

/** Moves a group to the end of the groups of another tab. */
export const moveGroupToTab = (tree: Tree, from: GroupRef, tab: number): Tree =>
	moveGroup(tree, from, { tab, index: Number.MAX_SAFE_INTEGER });

/** Moves a field to the end of the fields in no group of a tab. */
export const moveFieldToTab = (tree: Tree, name: string, tab: number): Tree => placeField(tree, name, tab, null);

/** Why a tab name cannot be used (`taken` when another tab has it, `empty`), or `null`. */
export function tabProblem(tree: Tree, name: string, except?: number): "empty" | "taken" | null {
	if (name.trim() === "") return "empty";
	return tree.tabs.some((tab, at) => at !== except && tab.name === name.trim()) ? "taken" : null;
}

export function addTab(tree: Tree, name: string): Tree {
	const next = copy(tree);
	if (tabProblem(next, name) === null) next.tabs.push({ name: name.trim(), groups: [], ungrouped: [], locked: [] });
	return next;
}

/** Whether a tab can be renamed or removed: not the default one, and not one a plugin puts fields in. */
export const tabIsEditable = (tree: Tree, index: number): boolean =>
	index > 0 && (tree.tabs[index]?.locked.length ?? 0) === 0;

export function renameTab(tree: Tree, index: number, name: string): Tree {
	const next = copy(tree);
	const tab = next.tabs[index];
	if (tab && tabIsEditable(tree, index) && tabProblem(tree, name, index) === null) tab.name = name.trim();
	return next;
}

/** Removes a tab; its groups and fields go to the default tab, after what is there. */
export function removeTab(tree: Tree, index: number): Tree {
	const next = copy(tree);
	const removed = next.tabs[index];
	const first = next.tabs[0];
	if (!removed || !first || !tabIsEditable(tree, index)) return next;
	next.tabs.splice(index, 1);
	first.groups.push(...removed.groups);
	first.ungrouped.push(...removed.ungrouped);
	return next;
}

/** Moves a tab one step; the default tab stays first. */
export function moveTab(tree: Tree, index: number, delta: -1 | 1): Tree {
	const next = copy(tree);
	const to = index + delta;
	if (index < 1 || to < 1 || to >= next.tabs.length) return next;
	const [moved] = next.tabs.splice(index, 1);
	if (moved) next.tabs.splice(to, 0, moved);
	return next;
}

/** Whether the tree has more than the default tab: only then does the tree show the tab level. */
export const hasTabLevel = (tree: Tree): boolean => tree.tabs.length > 1;

/** Looks a tab up by its name, falling back to the default tab. */
export const tabIndex = (tree: Tree, name: string, defaultTab: string): number => tabOfName(tree, name, defaultTab);
