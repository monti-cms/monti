import type { BlockDefinition } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import { type Node as PmNode } from "@tiptap/pm/model";
import { type NodeViewProps } from "@tiptap/react";
import { type ComponentProps, type ComponentType, type CSSProperties, type ElementType, type ReactNode, type Ref } from "react";
import { type EditorResult } from "../../hooks/result.js";
/** The attribute values of a block (directive attributes of an added block, node attributes of image and file). Only strings and booleans. */
export type BlockValues = Readonly<Record<string, string | boolean>>;
/**
 * A value to write to a block attribute. For an added block `""`, `false` and `null` remove the attribute (a saved `title=""` would not be in the
 * source). For image and file the value is stored as given, so `null` clears an attribute that defaults to empty.
 */
export type BlockValueInput = string | boolean | null;
/**
 * A child of a container block: a tab of tabs, a column of columns, a code block of a code explorer.
 *
 * @experimental
 */
export interface BlockChild {
    readonly index: number;
    /** Stored block id, if the child has one. */
    readonly id: string | null;
    /** Block definition name (`tab`, `column`), or the editor node type (`codeBlock`, `paragraph`) for a body block. */
    readonly name: string;
    readonly values: BlockValues;
}
/**
 * What a new child is made of.
 *
 * @experimental
 */
export interface BlockChildInit {
    /**
     * Block definition name (`tab`) or editor node type (`codeBlock`) of the child. Default: the first block of `definition.children.blocks`.
     * Required for a container that holds body content, which has no child block list.
     */
    readonly name?: string;
    /** Initial attribute values. Empty values are left out. */
    readonly values?: Readonly<Record<string, BlockValueInput>>;
    /** Position among the children. Default: the end. */
    readonly at?: number | "end";
}
/**
 * One child of a block inside {@link BlockTransaction}.
 *
 * @experimental
 */
export interface BlockTransactionChild {
    readonly values: BlockValues;
    setValue(name: string, value: BlockValueInput): void;
}
/**
 * The block inside {@link BlockEditor.transact}. Every method reads and writes the live document, so a later call sees the earlier ones.
 * A method that breaks a rule (`limit`, `invalid_state`, `read_only`) stops the whole transaction: `transact` returns the failure and writes nothing.
 *
 * @experimental
 */
export interface BlockTransaction {
    /** The block's values right now, including edits made earlier in this transaction. */
    readonly values: BlockValues;
    setValue(name: string, value: BlockValueInput): void;
    setValues(patch: Readonly<Record<string, BlockValueInput>>): void;
    readonly children: readonly BlockChild[];
    child(index: number): BlockTransactionChild;
    /** Returns the index of the new child. */
    addChild(init?: BlockChildInit): number;
    removeChild(index: number): void;
    moveChild(from: number, to: number): void;
}
/**
 * The escape hatch of {@link BlockEditor}: the only place Tiptap and ProseMirror types appear in this API.
 * Use it for what the API above cannot do (measuring the DOM, plugins, a custom selection). It is not covered by the experimental API's
 * stability promise and may change in any release; if you keep reaching for it, open an issue so the API can grow instead.
 *
 * @experimental
 */
export interface BlockEditorRaw {
    readonly editor: Editor;
    /** The block's node as of the last render. Read the live one with `editor.state.doc.nodeAt(getPos())`. */
    readonly node: PmNode;
    readonly getPos: () => number | undefined;
}
/**
 * The block a block view edits: its attributes, selection state and children. Get it with {@link useBlockEditor}.
 * Commands return {@link EditorResult} and never throw for expected failures (`read_only`, `limit`, `invalid_state`).
 *
 * @experimental
 */
export interface BlockEditor<V extends BlockValues = BlockValues> {
    /** Block definition name: `tabs`, `image`, `math`, a site block. */
    readonly name: string;
    readonly definition: BlockDefinition;
    /** Stable block id. Use it as a slot `scope`. `null` until the editor has assigned one. */
    readonly id: string | null;
    /** The block's attribute values. Empty ones (empty string, false, unset) are absent. */
    readonly values: Readonly<V>;
    setValue(name: keyof V & string, value: BlockValueInput): EditorResult;
    /** Several values in one document change (one undo step). */
    setValues(patch: Readonly<Partial<Record<keyof V & string, BlockValueInput>>>): EditorResult;
    /** The source text of a block written as code (math, code fence blocks). `undefined` for other blocks. */
    readonly source: string | undefined;
    setSource(next: string): EditorResult;
    /** Follows the lock (trash, source mode). Write commands fail with `read_only` while it is `false`. */
    readonly editable: boolean;
    /** The block itself is selected (a node selection). */
    readonly selected: boolean;
    /** The child the cursor is in. `null` when the cursor is outside the block or the editor has no focus. */
    readonly focusedChild: number | null;
    /** Selects the whole block. */
    select(): void;
    /** Moves the cursor into the block, optionally into one child and to its start or end. */
    focus(target?: {
        readonly child?: number;
        readonly at?: "start" | "end";
    }): void;
    remove(): EditorResult;
    /**
     * Text before and after the block, up to `chars` each (default 1500), for AI context. `marker` stands where the block is
     * (before, a line with the marker, after).
     */
    textAround(chars?: number, marker?: string): string;
    /** The direct children of a container block. Empty for a block without a body. */
    readonly children: readonly BlockChild[];
    /** The editor is editable, the block holds children and `definition.children.max` is not reached. */
    readonly canAddChild: boolean;
    /** The editor is editable, the child exists and `definition.children.min` (1 if unset) stays satisfied. */
    canRemoveChild(index: number): boolean;
    addChild(init?: BlockChildInit & {
        readonly focus?: boolean;
    }): EditorResult<{
        readonly index: number;
    }>;
    removeChild(index: number): EditorResult;
    moveChild(from: number, to: number): EditorResult;
    setChildValue(index: number, name: string, value: BlockValueInput): EditorResult;
    /**
     * Runs several edits as ONE document change, which is one undo step. It reads the live document, not the last render, so an edit
     * can depend on an earlier one (renaming a tab that is the default tab also renames the default). If `run` calls a method that breaks
     * a rule, nothing is written and the failure is returned.
     */
    transact(run: (tx: BlockTransaction) => void): EditorResult;
    /** Unstable escape hatch. See {@link BlockEditorRaw}. */
    readonly raw: BlockEditorRaw;
}
/**
 * The edit view of a block. Registered by block name in `blockViews` (`CmsAdminComponents`) for every block, including the core image, file
 * and math blocks. It takes no props: it reads its block with {@link useBlockEditor} and draws the nested body with {@link Content}.
 *
 * @experimental
 */
export type BlockView = ComponentType;
/**
 * The block the surrounding block view edits. Call it inside a component registered in `blockViews`; anywhere else it throws.
 *
 * @experimental
 */
export declare function useBlockEditor<V extends BlockValues = BlockValues>(): BlockEditor<V>;
/** What the node view renderer hands to the block: the pieces of `NodeViewProps` the block editor uses. */
export type NodeViewBinding = Pick<NodeViewProps, "editor" | "node" | "getPos" | "updateAttributes" | "selected">;
/**
 * Gives a block view its {@link BlockEditor}. The node view renderer (`BlockNodeView`) wraps every block view in it; it is not part of the
 * public API. A test or a preview can wrap a view in it with the pieces of a node view.
 */
export declare function BlockEditorProvider({ nodeView, definition, children, }: {
    readonly nodeView: NodeViewBinding;
    readonly definition: BlockDefinition;
    readonly children: ReactNode;
}): import("react").JSX.Element;
/** Props of {@link Content}. Other attributes (`data-*`, `aria-*`, `id`) are passed to the content element. */
export interface ContentProps extends Omit<ComponentProps<"div">, "ref" | "children" | "className" | "style"> {
    readonly className?: string;
    readonly style?: CSSProperties;
    /** Element to render. Default `div`. */
    readonly as?: ElementType;
    /** Show only this child (0-based) and hide the others, like the active tab of tabs. Default: show all. */
    readonly visibleChild?: number;
}
/**
 * The editable nested body of a container block: the place where the block's children are edited in the document. It replaces the Tiptap
 * node view content. A block without a body (image, math) renders nothing.
 *
 * DOM contract: the element has `data-cms-block-content`, and the child blocks are inside its first child element
 * (`[data-cms-block-content] > *` holds them), so a view can lay them out with `[&>*]:grid` or `[&>*>:first-child]:mt-0`.
 *
 * @experimental
 */
export declare function Content({ className, style, as, visibleChild, ...rest }: ContentProps): import("react").JSX.Element | null;
/** Props of {@link BlockFrame}. Other attributes (`data-*`, `aria-*`, `style`, `id`) are passed to the frame element. */
export interface BlockFrameProps extends Omit<ComponentProps<"div">, "ref"> {
    /** Element to render. Default `div` (image uses `figure`). */
    readonly as?: ElementType;
    readonly ref?: Ref<HTMLElement>;
    /**
     * The standard bordered-block frame: the hover scope that shows the block's toolbar (`group/container`), the positioning context for
     * it, and the mark the drag handle aligns to. Default `true`. A block that only fills a slot of its parent (a tab, a column) passes `false`.
     */
    readonly framed?: boolean;
    /** Draw the selected ring while the block is selected. Default `true`. */
    readonly selectedRing?: boolean;
}
/**
 * The outer element of a block view: the editor's node view wrapper plus the standard frame (selected ring, hover scope, the attributes
 * the editor relies on). Every block view renders one around its content.
 *
 * @experimental
 */
export declare function BlockFrame({ as, ref, framed, selectedRing, className, children, ...rest }: BlockFrameProps): import("react").JSX.Element;
