import { fieldsOf, layoutOf, type Obj, setProp, titleFieldName, withLayout } from "./schema-model";

/**
 * The properties panel of the edit screen as the fields tree shows it: tab, then an ordered list of blocks, each a titled group or a run of fields in no group.
 * A run sits exactly where the panel draws it (a `layout` group without a title), before, between or after groups, so the tree, the schema and the panel
 * say the same thing and an edit never moves fields it was not about. Saving writes the order of `fields` and `layout` together from the tree.
 *
 * It follows `layoutGroupsOf` (the rules of the real panel):
 * - a `layout` group sits in its `tab`, or in the default tab; fields in no `layout` group come last, in the default tab;
 * - a field with a `tab` of its own (placed by a plugin) is drawn in that tab, whatever the layout says: it is locked there;
 * - the title field and `hidden` fields are not drawn in the panel: they are pinned and never join a block.
 */
export interface Block {
	/** The title of a group; `null` for a run of fields in no group. */
	title: string | null;
	collapsed?: boolean;
	fields: string[];
}

export interface Tab {
	name: string;
	blocks: Block[];
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
	block: number;
	index: number;
}

/** A block of a tab. */
export interface BlockRef {
	tab: number;
	block: number;
}

const copy = (tree: Tree): Tree => structuredClone(tree);
const isRun = (block: Block | undefined): block is Block & { title: null } =>
	block !== undefined && block.title === null;

/** Drops empty runs and joins runs that touch: neither shows in the panel. */
function tidy(tab: Tab): void {
	const out: Block[] = [];
	for (const block of tab.blocks) {
		if (isRun(block)) {
			if (block.fields.length === 0) continue;
			const last = out.at(-1);
			if (isRun(last)) {
				last.fields.push(...block.fields);
				continue;
			}
		}
		out.push(block);
	}
	tab.blocks = out;
}

const tidied = (tree: Tree): Tree => {
	for (const tab of tree.tabs) tidy(tab);
	return tree;
};

/** The tree of a collection. `defaultTab` is the name of the panel's first tab. */
export function treeOf(collection: Obj, defaultTab: string): Tree {
	const names = Object.keys(fieldsOf(collection));
	const pinned = names.filter((name) => noPanelReason(collection, name) !== null);
	const locked = (name: string) => !pinned.includes(name) && ownTabOf(collection, name) !== undefined;
	const tree: Tree = { pinned, tabs: [{ name: defaultTab, blocks: [], locked: [] }] };
	const tab = (name: string): Tab => {
		const found = tree.tabs.find((item) => item.name === name);
		if (found) return found;
		const created: Tab = { name, blocks: [], locked: [] };
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
		target.blocks.push({
			title: group.group ? group.group : null,
			...(group.group && group.collapsed === true ? { collapsed: true } : {}),
			fields,
		});
	}
	const rest: string[] = [];
	for (const name of names) {
		if (pinned.includes(name)) continue;
		const own = ownTabOf(collection, name);
		if (own !== undefined) tab(own).locked.push(name);
		else if (!placed.has(name)) rest.push(name);
	}
	(tree.tabs[0] as Tab).blocks.push({ title: null, fields: rest });
	return tidied(tree);
}

/**
 * The collection with its fields in the order of the tree and its `layout` the tree's blocks, in place. The default tab's last run needs no entry (fields in no
 * group come last anyway); a tab other than the default one always has an entry, so it exists in the file.
 */
export function withTree(collection: Obj, tree: Tree): Obj {
	const fields = fieldsOf(collection);
	const order = [
		...tree.pinned,
		...tree.tabs.flatMap((tab) => [...tab.blocks.flatMap((block) => block.fields), ...tab.locked]),
	].filter((name, at, all) => name in fields && all.indexOf(name) === at);
	const rest = Object.keys(fields).filter((name) => !order.includes(name));
	const ordered = Object.fromEntries([...order, ...rest].map((name) => [name, fields[name] as Obj]));
	const layout = tree.tabs.flatMap((tab, at) => {
		const tabKey = at === 0 ? {} : { tab: tab.name };
		const blocks = at === 0 && isRun(tab.blocks.at(-1)) ? tab.blocks.slice(0, -1) : tab.blocks;
		const entries = blocks.map((block) => ({
			...(block.title !== null ? { group: block.title } : {}),
			fields: block.fields,
			...tabKey,
			...(block.collapsed === true ? { collapsed: true } : {}),
		}));
		return at > 0 && entries.length === 0 ? [{ fields: [], ...tabKey }] : entries;
	});
	return withLayout(setProp(collection, "fields", ordered), layout);
}

export function placeOf(tree: Tree, name: string): Place | null {
	for (const [tab, node] of tree.tabs.entries()) {
		for (const [block, item] of node.blocks.entries()) {
			const index = item.fields.indexOf(name);
			if (index !== -1) return { tab, block, index };
		}
	}
	return null;
}

const removeField = (tree: Tree, name: string): boolean => {
	const from = placeOf(tree, name);
	if (!from) return false;
	(tree.tabs[from.tab]?.blocks[from.block] as Block).fields.splice(from.index, 1);
	return true;
};

/** Puts the field at `position` of a block (the end when omitted). A locked or pinned field does not move. */
export function placeField(tree: Tree, name: string, tab: number, block: number, position?: number): Tree {
	const next = copy(tree);
	const target = next.tabs[tab]?.blocks[block];
	if (!target || !placeOf(next, name)) return next;
	// The target is looked up again after the removal and the tidying, which can shift block numbers.
	if (!removeField(next, name)) return next;
	target.fields.splice(
		position === undefined ? target.fields.length : Math.min(position, target.fields.length),
		0,
		name,
	);
	return tidied(next);
}

/**
 * Puts the field in no group, between blocks: before block number `at` of the tab (the end when omitted). It joins the run next to that place, or starts one.
 */
export function placeUngrouped(tree: Tree, name: string, tab: number, at?: number): Tree {
	const next = copy(tree);
	const node = next.tabs[tab];
	if (!node || !placeOf(next, name)) return next;
	const before = at === undefined ? undefined : node.blocks[at];
	const previous = at === undefined ? node.blocks.at(-1) : node.blocks[at - 1];
	removeField(next, name);
	if (isRun(previous)) previous.fields.push(name);
	else if (isRun(before)) before.fields.unshift(name);
	else
		node.blocks.splice(before ? node.blocks.indexOf(before) : node.blocks.length, 0, { title: null, fields: [name] });
	return tidied(next);
}

/** Drops a field on another field: it takes that field's place, in that field's group or run. */
export function dropFieldOnField(tree: Tree, name: string, over: string): Tree {
	const at = placeOf(tree, over);
	if (!at || name === over) return copy(tree);
	return placeField(tree, name, at.tab, at.block, at.index);
}

/** The blocks of the tab with the fields of each, as the tree draws them top to bottom: one step of a field is one step along this list. */
export function moveFieldBy(tree: Tree, name: string, delta: -1 | 1): Tree {
	const from = placeOf(tree, name);
	if (!from) return copy(tree);
	const list = (tree.tabs[from.tab] as Tab).blocks[from.block]?.fields ?? [];
	const to = from.index + delta;
	if (to >= 0 && to < list.length) return placeField(tree, name, from.tab, from.block, to);
	const tab = tree.tabs[from.tab] as Tab;
	const neighbour = tab.blocks[from.block + delta];
	if (neighbour) return placeField(tree, name, from.tab, from.block + delta, delta < 0 ? undefined : 0);
	// The edge of the tab: on to the next tab.
	const nextTab = tree.tabs[from.tab + delta];
	if (!nextTab) return copy(tree);
	return delta < 0 ? placeUngrouped(tree, name, from.tab + delta) : placeUngrouped(tree, name, from.tab + delta, 0);
}

/** Takes the field out of its group, to just after it (or into the run that follows). A field already in no group stays. */
export function moveOutOfGroup(tree: Tree, name: string): Tree {
	const at = placeOf(tree, name);
	if (!at || isRun(tree.tabs[at.tab]?.blocks[at.block])) return copy(tree);
	return placeUngrouped(tree, name, at.tab, at.block + 1);
}

/** A new group at the end of a tab. */
export function addGroup(tree: Tree, tab: number, title: string): Tree {
	const next = copy(tree);
	next.tabs[tab]?.blocks.push({ title, fields: [] });
	return next;
}

export function editGroup(tree: Tree, ref: BlockRef, patch: { title?: string; collapsed?: boolean }): Tree {
	const next = copy(tree);
	const group = next.tabs[ref.tab]?.blocks[ref.block];
	if (!group || group.title === null) return next;
	if (patch.title !== undefined && patch.title.trim() !== "") group.title = patch.title.trim();
	if (patch.collapsed !== undefined) {
		if (patch.collapsed) group.collapsed = true;
		else delete group.collapsed;
	}
	return next;
}

/** Removes a group; its fields stay where they are, in no group. */
export function removeGroup(tree: Tree, ref: BlockRef): Tree {
	const next = copy(tree);
	const group = next.tabs[ref.tab]?.blocks[ref.block];
	if (!group || group.title === null) return next;
	next.tabs[ref.tab]?.blocks.splice(ref.block, 1, { title: null, fields: group.fields });
	return tidied(next);
}

/** Moves a block (with its fields) to the place of another block, in its tab or in another one; `to.block` past the last block means the end. */
export function moveGroup(tree: Tree, from: BlockRef, to: BlockRef): Tree {
	const next = copy(tree);
	const [moved] = next.tabs[from.tab]?.blocks.splice(from.block, 1) ?? [];
	const target = next.tabs[to.tab];
	if (!moved || !target) return copy(tree);
	target.blocks.splice(Math.min(to.block, target.blocks.length), 0, moved);
	return tidied(next);
}

/** One step among the blocks of the tab: a group passes the run of fields in no group beside it. */
export function moveGroupBy(tree: Tree, ref: BlockRef, delta: -1 | 1): Tree {
	const count = tree.tabs[ref.tab]?.blocks.length ?? 0;
	const to = ref.block + delta;
	return to < 0 || to >= count ? copy(tree) : moveGroup(tree, ref, { tab: ref.tab, block: to });
}

/** Moves a group to the end of another tab. */
export const moveGroupToTab = (tree: Tree, from: BlockRef, tab: number): Tree =>
	moveGroup(tree, from, { tab, block: Number.MAX_SAFE_INTEGER });

/** Moves a field, in no group, to the end of a tab. */
export const moveFieldToTab = (tree: Tree, name: string, tab: number): Tree => placeUngrouped(tree, name, tab);

/** Why a tab name cannot be used (`taken` when another tab has it, `empty`), or `null`. */
export function tabProblem(tree: Tree, name: string, except?: number): "empty" | "taken" | null {
	if (name.trim() === "") return "empty";
	return tree.tabs.some((tab, at) => at !== except && tab.name === name.trim()) ? "taken" : null;
}

export function addTab(tree: Tree, name: string): Tree {
	const next = copy(tree);
	if (tabProblem(next, name) === null) next.tabs.push({ name: name.trim(), blocks: [], locked: [] });
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

/** Removes a tab; its blocks go to the end of the default tab. */
export function removeTab(tree: Tree, index: number): Tree {
	const next = copy(tree);
	const removed = next.tabs[index];
	const first = next.tabs[0];
	if (!removed || !first || !tabIsEditable(tree, index)) return next;
	next.tabs.splice(index, 1);
	first.blocks.push(...removed.blocks);
	return tidied(next);
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
