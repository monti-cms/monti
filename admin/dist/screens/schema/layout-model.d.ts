import { type NamedPlacement } from "@monti-cms/core/client";
import { type Obj } from "./schema-model.js";
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
/** The tree of a collection, from the groups of the real panel. `placements` are what the site's plugins place (`placementsOf(site.plugins)`). */
export declare function treeOf(collection: Obj, placements: readonly NamedPlacement[]): Tree;
/**
 * The collection with its fields in the order of the tree and its `layout` the tree's blocks, in place. The default tab's last run needs no entry (fields in no
 * group come last anyway); a tab other than the default one always has an entry, so it exists in the file.
 */
export declare function withTree(collection: Obj, tree: Tree): Obj;
export declare function placeOf(tree: Tree, name: string): Place | null;
/** Puts the field at `position` of a block (the end when omitted). A locked or pinned field does not move. */
export declare function placeField(tree: Tree, name: string, tab: number, block: number, position?: number): Tree;
/**
 * Puts the field in no group, between blocks: before block number `at` of the tab (the end when omitted). It joins the run next to that place, or starts one.
 */
export declare function placeUngrouped(tree: Tree, name: string, tab: number, at?: number): Tree;
/** Drops a field on another field: it takes that field's place, in that field's group or run. */
export declare function dropFieldOnField(tree: Tree, name: string, over: string): Tree;
/** The blocks of the tab with the fields of each, as the tree draws them top to bottom: one step of a field is one step along this list. */
export declare function moveFieldBy(tree: Tree, name: string, delta: -1 | 1): Tree;
/** Takes the field out of its group, to just after it (or into the run that follows). A field already in no group stays. */
export declare function moveOutOfGroup(tree: Tree, name: string): Tree;
/** A new group at the end of a tab. */
export declare function addGroup(tree: Tree, tab: number, title: string): Tree;
export declare function editGroup(tree: Tree, ref: BlockRef, patch: {
    title?: string;
    collapsed?: boolean;
}): Tree;
/** Removes a group; its fields stay where they are, in no group. */
export declare function removeGroup(tree: Tree, ref: BlockRef): Tree;
/** Moves a block (with its fields) to the place of another block, in its tab or in another one; `to.block` past the last block means the end. */
export declare function moveGroup(tree: Tree, from: BlockRef, to: BlockRef): Tree;
/** One step among the blocks of the tab: a group passes the run of fields in no group beside it. */
export declare function moveGroupBy(tree: Tree, ref: BlockRef, delta: -1 | 1): Tree;
/** Moves a group to the end of another tab. */
export declare const moveGroupToTab: (tree: Tree, from: BlockRef, tab: number) => Tree;
/** Why a tab name cannot be used (`taken` when another tab has it, `empty`), or `null`. */
export declare function tabProblem(tree: Tree, name: string, except?: number, defaultLabel?: string): "empty" | "taken" | "too-long" | null;
export declare function addTab(tree: Tree, name: string): Tree;
/** Whether a tab can be renamed: any tab that is not locked by a plugin. */
export declare const tabCanRename: (tree: Tree, index: number) => boolean;
/** Whether a tab can be removed: only user-added tabs after the default tab, and not locked by a plugin. */
export declare const tabCanRemove: (tree: Tree, index: number) => boolean;
/** Whether a tab can be moved: only user-added tabs after the default tab, and not plugin-only. */
export declare const tabCanMove: (tree: Tree, index: number) => boolean;
/** Whether a tab can be removed: not the default one, and not one a plugin puts fields in. */
export declare const tabIsEditable: typeof tabCanRemove;
export declare function renameTab(tree: Tree, index: number, name: string, defaultLabel?: string): Tree;
/** Removes a tab; its blocks go to the end of the default tab. */
export declare function removeTab(tree: Tree, index: number): Tree;
/** Moves a tab one step; the default tab stays first. */
export declare function moveTab(tree: Tree, index: number, delta: -1 | 1): Tree;
/** Whether the tree has more than the default tab. */
export declare const hasTabLevel: (tree: Tree) => boolean;
