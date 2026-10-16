import {
	DEFAULT_TAB,
	isPanelField,
	type NamedPlacement,
	type PanelSource,
	panelGroupsOf,
} from "@monti-cms/core/client";
import { moveWithin } from "../../lib/utils/move-within";
import { COLLECTION_KEY_ORDER, fieldsOf, type Obj, setProp, withLayout } from "./schema-model";

/**
 * The properties panel of the edit screen as the fields tree shows it: tab, then an ordered list of blocks, each a titled group or a run of fields in no group.
 * A run sits exactly where the panel draws it (a `layout` group without a title), before, between or after groups, so the tree, the schema and the panel
 * say the same thing and an edit never moves fields it was not about. Saving writes the order of `fields` and `layout` together from the tree.
 *
 * The groups are not worked out here: they are core's (`panelGroupsOf`, the algorithm the real panel runs), and the tree is the same groups drawn as rows. So:
 * - a `layout` group sits in its `tab`, or in the default tab; fields in no `layout` group come last, in the default tab;
 * - the fields a plugin places (`contributes.layout`) are drawn in the plugin's tab, whatever the layout says: they are locked there;
 * - the fields the panel does not draw (the title of a document) are pinned and never join a block.
 */
export interface Block {
	/** The title of a group; `null` for a run of fields in no group. */
	title: string | null;
	collapsed?: boolean;
	fields: string[];
}

export interface Tab {
	/** The tab's id: {@link DEFAULT_TAB} for the first one, the name a person wrote for the others. The screens translate the first one to show it. */
	name: string;
	blocks: Block[];
	/** Fields a plugin placed in this tab: shown here, never movable. */
	locked: string[];
}

export interface Tree {
	/** Custom title for the default properties tab. If omitted, uses the admin's translated default ("Properties"). */
	defaultTab?: string;
	/** Fields the panel does not draw (the title of a document): they only define the order of `fields`. */
	pinned: string[];
	/** The default tab first, then the others in the order the panel shows them. */
	tabs: Tab[];
}

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

/** A tab only a plugin fills: it has no group of the site's, so it exists without an entry in the layout. */
const pluginOnly = (tab: Tab): boolean => tab.blocks.length === 0 && tab.locked.length > 0;

/**
 * Cleans the blocks of every tab and puts the tabs in the order the panel draws them: the default tab, the tabs that have a group of the site's, then the tabs only a
 * plugin fills (the panel draws what plugins place after everything the layout says).
 */
const tidied = (tree: Tree): Tree => {
	for (const tab of tree.tabs) tidy(tab);
	const [first, ...others] = tree.tabs;
	if (first) tree.tabs = [first, ...others.filter((tab) => !pluginOnly(tab)), ...others.filter(pluginOnly)];
	return tree;
};

/** The tree of a collection, from the groups of the real panel. `placements` are what the site's plugins place (`placementsOf(site.plugins)`). */
export function treeOf(collection: Obj, placements: readonly NamedPlacement[]): Tree {
	const source = collection as unknown as PanelSource;
	const tree: Tree = {
		...(typeof collection.defaultTab === "string" && collection.defaultTab.trim() !== ""
			? { defaultTab: collection.defaultTab.trim() }
			: {}),
		pinned: Object.keys(fieldsOf(collection)).filter((name) => !isPanelField(source, name)),
		tabs: [{ name: DEFAULT_TAB, blocks: [], locked: [] }],
	};
	const tab = (name: string): Tab => {
		const found = tree.tabs.find((item) => item.name === name);
		if (found) return found;
		const created: Tab = { name, blocks: [], locked: [] };
		tree.tabs.push(created);
		return created;
	};
	for (const group of panelGroupsOf(source, placements)) {
		const target = tab(group.tab);
		if (group.placedBy !== undefined) {
			target.locked.push(...group.fields);
			continue;
		}
		target.blocks.push({
			title: group.group ?? null,
			...(group.collapsed === true ? { collapsed: true } : {}),
			fields: [...group.fields],
		});
	}
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
		// A tab a plugin fills exists without an entry; any other tab needs one to exist in the file.
		return at > 0 && entries.length === 0 && tab.locked.length === 0 ? [{ fields: [], ...tabKey }] : entries;
	});
	const withFields = setProp(collection, "fields", ordered);
	const withDefaultTab = setProp(withFields, "defaultTab", tree.defaultTab, COLLECTION_KEY_ORDER);
	return withLayout(withDefaultTab, layout);
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
	if (from.tab === to.tab) {
		const tab = next.tabs[from.tab];
		if (!tab) return next;
		tab.blocks = moveWithin(tab.blocks, from.block, to.block);
		return tidied(next);
	}
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

/** Why a tab name cannot be used (`taken` when another tab has it, `empty`), or `null`. */
export function tabProblem(
	tree: Tree,
	name: string,
	except?: number,
	defaultLabel?: string,
): "empty" | "taken" | "too-long" | null {
	const trimmed = name.trim();
	if (trimmed === "") return "empty";
	if (trimmed.length > 20) return "too-long";
	const currentNameOf = (at: number) => {
		if (at === 0) return (tree.defaultTab ?? defaultLabel ?? "").trim();
		return tree.tabs[at]?.name.trim() ?? "";
	};
	return tree.tabs.some((_tab, at) => at !== except && currentNameOf(at) === trimmed) ? "taken" : null;
}

export function addTab(tree: Tree, name: string): Tree {
	const next = copy(tree);
	if (tabProblem(next, name) === null) next.tabs.push({ name: name.trim(), blocks: [], locked: [] });
	return tidied(next);
}

/** Whether a tab can be renamed: any tab that is not locked by a plugin. */
export const tabCanRename = (tree: Tree, index: number): boolean => (tree.tabs[index]?.locked.length ?? 0) === 0;

/** Whether a tab can be removed: only user-added tabs after the default tab, and not locked by a plugin. */
export const tabCanRemove = (tree: Tree, index: number): boolean =>
	index > 0 && (tree.tabs[index]?.locked.length ?? 0) === 0;

export function renameTab(tree: Tree, index: number, name: string, defaultLabel?: string): Tree {
	const next = copy(tree);
	const tab = next.tabs[index];
	if (!tab || !tabCanRename(tree, index)) return next;
	const trimmed = name.trim();
	if (index === 0) {
		if (trimmed === "" || (defaultLabel !== undefined && trimmed === defaultLabel.trim())) {
			delete next.defaultTab;
			return next;
		}
		if (tabProblem(tree, trimmed, 0, defaultLabel) === null) {
			next.defaultTab = trimmed;
		}
		return next;
	}
	if (tabProblem(tree, trimmed, index, defaultLabel) === null) {
		tab.name = trimmed;
	}
	return next;
}

/** Removes a tab; its blocks go to the end of the default tab. */
export function removeTab(tree: Tree, index: number): Tree {
	const next = copy(tree);
	const removed = next.tabs[index];
	const first = next.tabs[0];
	if (!removed || !first || !tabCanRemove(tree, index)) return next;
	next.tabs.splice(index, 1);
	first.blocks.push(...removed.blocks);
	return tidied(next);
}

/** Moves a tab one step; the default tab stays first. */
export function moveTab(tree: Tree, index: number, delta: -1 | 1): Tree {
	const next = copy(tree);
	const to = index + delta;
	const movable = next.tabs.filter((tab, at) => at > 0 && !pluginOnly(tab)).length;
	const tab = next.tabs[index];
	if (index < 1 || to < 1 || to > movable || !tab || pluginOnly(tab)) return next;
	next.tabs = moveWithin(next.tabs, index, to);
	return next;
}

/** Whether the tree has more than the default tab. */
export const hasTabLevel = (tree: Tree): boolean => tree.tabs.length > 1;
