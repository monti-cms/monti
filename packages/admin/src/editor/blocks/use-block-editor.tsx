"use client";

import { type BlockDefinition, createTranslator } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import { Fragment, type NodeType, type Node as PmNode } from "@tiptap/pm/model";
import { NodeSelection, TextSelection, type Transaction } from "@tiptap/pm/state";
import { NodeViewContent, type NodeViewProps, NodeViewWrapper, useEditorState } from "@tiptap/react";
import {
	type ComponentProps,
	type ComponentType,
	type CSSProperties,
	createContext,
	type ElementType,
	type ReactNode,
	type Ref,
	useContext,
	useId,
	useMemo,
	useRef,
} from "react";
import { type EditorError, type EditorResult, editorFailure } from "../../hooks/result";
import { cn } from "../../lib/utils/cn";
import { BLOCK_ID_ATTRIBUTE } from "../block-ids";
import { blockNodeName } from "./added/shared";
import { type ContainerValues, childPos, SELECTED_RING, useEditorEditable, valuesOf, withValue } from "./block-model";
import { blocksMessages } from "./messages";
import { blockOfNode } from "./node-block";

const t = createTranslator(blocksMessages);

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
	focus(target?: { readonly child?: number; readonly at?: "start" | "end" }): void;
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
	addChild(init?: BlockChildInit & { readonly focus?: boolean }): EditorResult<{ readonly index: number }>;
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

const BlockEditorContext = createContext<BlockEditor | null>(null);

/**
 * The block the surrounding block view edits. Call it inside a component registered in `blockViews`; anywhere else it throws.
 *
 * @experimental
 */
export function useBlockEditor<V extends BlockValues = BlockValues>(): BlockEditor<V> {
	const block = useContext(BlockEditorContext);
	if (!block)
		throw new Error("useBlockEditor must be called inside a block view (a component registered in `blockViews`).");
	return block as unknown as BlockEditor<V>;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Implementation over a Tiptap node view

/** What the node view renderer hands to the block: the pieces of `NodeViewProps` the block editor uses. */
export type NodeViewBinding = Pick<NodeViewProps, "editor" | "node" | "getPos" | "updateAttributes" | "selected">;

interface Binding extends NodeViewBinding {
	readonly definition: BlockDefinition;
}

/** A failure that stops a transaction and becomes the result of the command. */
class BlockAbort extends Error {
	constructor(readonly error: EditorError) {
		super(error.message);
	}
}

const abort = (code: EditorError["code"], message: string) =>
	new BlockAbort({ code, message, retryable: false } satisfies EditorError);

/** Whether the block's attributes live in one `values` map (added blocks) or are flat node attributes (image, file, math). */
const hasValuesMap = (node: PmNode) => node.attrs != null && "values" in node.attrs;

const typeHasValuesMap = (type: NodeType) => Boolean(type.spec.attrs && "values" in type.spec.attrs);

/** Attributes that are not block values: the stored id and the source text of code blocks. */
const INTERNAL_ATTRIBUTES: ReadonlySet<string> = new Set([BLOCK_ID_ATTRIBUTE, "value"]);

const readValues = (node: PmNode): BlockValues => {
	if (hasValuesMap(node)) return valuesOf(node);
	const values: Record<string, string | boolean> = {};
	for (const [key, value] of Object.entries(node.attrs ?? {})) {
		if (INTERNAL_ATTRIBUTES.has(key)) continue;
		if (typeof value === "string" || typeof value === "boolean") values[key] = value;
		else if (typeof value === "number") values[key] = String(value);
	}
	return values;
};

const readId = (node: PmNode): string | null => {
	const id = node.attrs?.[BLOCK_ID_ATTRIBUTE];
	return typeof id === "string" && id ? id : null;
};

const describeChild = (child: PmNode, index: number): BlockChild => ({
	index,
	id: readId(child),
	name: blockOfNode(child.type.name)?.name ?? child.type.name,
	values: readValues(child),
});

const childrenOf = (node: PmNode): readonly BlockChild[] => {
	const children: BlockChild[] = [];
	node.forEach((child, _offset, index) => {
		children.push(describeChild(child, index));
	});
	return children;
};

/** The node's attributes after writing `patch`. Added blocks keep their values in one map; image and file store each value as given. */
const patchedAttributes = (node: PmNode, patch: Readonly<Record<string, BlockValueInput>>): Record<string, unknown> => {
	if (hasValuesMap(node)) {
		let values = valuesOf(node);
		for (const [name, value] of Object.entries(patch)) values = withValue(values, name, value ?? "");
		return { ...node.attrs, values };
	}
	return { ...node.attrs, ...patch };
};

const isEditable = (binding: Binding) => binding.editor?.isEditable ?? true;

const readOnly = () => editorFailure("read_only", t("block.readOnly"));
const detached = () => editorFailure("invalid_state", t("block.detached"));

/** The block's node in the live document. Falls back to the rendered node when there is no editor state to read (a preview, a test). */
const locate = (binding: Binding): { readonly node: PmNode; readonly pos: number } | null => {
	const pos = binding.getPos?.();
	if (typeof pos !== "number") return null;
	const doc = binding.editor?.state?.doc;
	if (!doc) return { node: binding.node, pos };
	const node = doc.nodeAt(pos);
	return node && node.type === binding.node.type ? { node, pos } : null;
};

function createTransaction(binding: Binding, tr: Transaction, pos: number): BlockTransaction {
	const { definition } = binding;
	const current = (): PmNode => {
		const node = tr.doc.nodeAt(pos);
		if (!node) throw abort("invalid_state", t("block.detached"));
		return node;
	};
	const childAt = (parent: PmNode, index: number): PmNode => {
		const child = Number.isInteger(index) ? parent.maybeChild(index) : null;
		if (!child) throw abort("invalid_state", t("block.childRange", { label: definition.label, index: index + 1 }));
		return child;
	};
	const minChildren = definition.children?.min ?? 1;
	const maxChildren = definition.children?.max;

	const childType = (name: string | undefined): NodeType => {
		const target = name ?? definition.children?.blocks?.[0];
		if (!target) throw abort("invalid_state", t("block.noChildren", { label: definition.label }));
		const { nodes } = tr.doc.type.schema;
		const type = nodes[target] ?? nodes[blockNodeName({ name: target })];
		if (!type) throw abort("invalid_state", t("block.unknownChild", { label: definition.label, name: target }));
		return type;
	};

	const setValues = (patch: Readonly<Record<string, BlockValueInput>>) => {
		const node = current();
		tr.setNodeMarkup(pos, undefined, patchedAttributes(node, patch));
	};

	return {
		get values() {
			return readValues(current());
		},
		setValue: (name, value) => setValues({ [name]: value }),
		setValues,
		get children() {
			return childrenOf(current());
		},
		child: (index) => ({
			get values() {
				return readValues(childAt(current(), index));
			},
			setValue(name, value) {
				const parent = current();
				const child = childAt(parent, index);
				tr.setNodeMarkup(childPos(parent, pos, index), undefined, patchedAttributes(child, { [name]: value }));
			},
		}),
		addChild(init = {}) {
			const parent = current();
			if (parent.type.isLeaf) throw abort("invalid_state", t("block.noChildren", { label: definition.label }));
			if (maxChildren !== undefined && parent.childCount >= maxChildren)
				throw abort("limit", t("block.childMax", { label: definition.label, count: maxChildren }));
			const type = childType(init.name);
			const index =
				typeof init.at === "number" ? Math.min(Math.max(Math.trunc(init.at), 0), parent.childCount) : parent.childCount;
			if (!parent.canReplaceWith(index, index, type))
				throw abort(
					"invalid_state",
					t("block.unknownChild", { label: definition.label, name: init.name ?? type.name }),
				);
			const values = Object.entries(init.values ?? {});
			const attrs: Record<string, unknown> = typeHasValuesMap(type)
				? { values: values.reduce<ContainerValues>((all, [name, value]) => withValue(all, name, value ?? ""), {}) }
				: Object.fromEntries(values);
			const child = type.createAndFill(attrs);
			if (!child) throw abort("invalid_state", t("block.childFailed"));
			tr.insert(childPos(parent, pos, index), child);
			return index;
		},
		removeChild(index) {
			const parent = current();
			const child = childAt(parent, index);
			if (parent.childCount <= minChildren)
				throw abort("limit", t("block.childMin", { label: definition.label, count: minChildren }));
			const from = childPos(parent, pos, index);
			tr.delete(from, from + child.nodeSize);
		},
		moveChild(from, to) {
			const parent = current();
			childAt(parent, from);
			childAt(parent, to);
			if (from === to) return;
			// One replace of the range the move touches, so the content stays valid at every step (deleting first would drop the block below
			// `children.min`, and ProseMirror would fill it back with an empty one).
			const first = Math.min(from, to);
			const last = Math.max(from, to);
			const order = Array.from({ length: parent.childCount }, (_, index) => index);
			order.splice(from, 1);
			order.splice(to, 0, from);
			const moved = order.slice(first, last + 1).map((index) => parent.child(index));
			const selection = tr.selection;
			// The child the text cursor is in moves with it.
			const owner =
				selection instanceof TextSelection
					? Array.from({ length: last - first + 1 }, (_, offset) => first + offset).find(
							(index) =>
								childPos(parent, pos, index) <= selection.from && selection.to <= childPos(parent, pos, index + 1),
						)
					: undefined;
			tr.replaceWith(childPos(parent, pos, first), childPos(parent, pos, last + 1), Fragment.from(moved));
			if (owner !== undefined) {
				const shift = childPos(current(), pos, order.indexOf(owner)) - childPos(parent, pos, owner);
				tr.setSelection(TextSelection.create(tr.doc, selection.from + shift, selection.to + shift));
			}
		},
	};
}

/** Runs `run` against one transaction and dispatches it once. Fails without writing when the editor is locked or the block is gone. */
function runTransaction<T>(binding: Binding, run: (tx: BlockTransaction) => T): EditorResult<T> {
	if (!isEditable(binding)) return readOnly();
	const located = locate(binding);
	if (!located) return detached();
	const { editor } = binding;
	const tr = editor.state.tr;
	try {
		const value = run(createTransaction(binding, tr, located.pos));
		if (tr.docChanged) editor.view.dispatch(tr);
		return { ok: true, value };
	} catch (error) {
		if (error instanceof BlockAbort) return { ok: false, error: error.error };
		throw error;
	}
}

/** Writes node attributes through the node view. Used for flat attributes (image, file, math, code fences) and the source text. */
function writeAttributes(binding: Binding, attributes: Record<string, unknown>): EditorResult {
	if (!isEditable(binding)) return readOnly();
	try {
		binding.updateAttributes(attributes);
	} catch {
		// The node left the document (an edit still pending while the view unmounts), so there is nowhere to write.
		return detached();
	}
	return { ok: true, value: undefined };
}

/** Moves the cursor into the block: a child (or the block's own start) and its start or end. */
function focusInside(binding: Binding, target: { readonly child?: number; readonly at?: "start" | "end" } = {}) {
	const pos = binding.getPos?.();
	if (typeof pos !== "number") return;
	const end = target.at === "end";
	binding.editor
		.chain()
		.focus()
		.command(({ tr }) => {
			const parent = tr.doc.nodeAt(pos);
			if (!parent) return false;
			let inside: number;
			if (target.child === undefined) {
				inside = end ? pos + parent.nodeSize - 1 : pos + 1;
			} else {
				const child = parent.maybeChild(target.child);
				if (!child) return false;
				const start = childPos(parent, pos, target.child);
				inside = end ? start + child.nodeSize - 1 : start + 1;
			}
			tr.setSelection(TextSelection.near(tr.doc.resolve(inside), end ? -1 : 1));
			return true;
		})
		.scrollIntoView()
		.run();
}

/** The commands. They read the latest binding at call time, so they keep one identity for the life of the block view. */
function createCommands(latest: { readonly current: Binding }) {
	const setValues = (patch: Readonly<Record<string, BlockValueInput>>): EditorResult => {
		const binding = latest.current;
		if (!hasValuesMap(binding.node)) return writeAttributes(binding, patch);
		return runTransaction(binding, (tx) => tx.setValues(patch));
	};
	return {
		setValue: (name: string, value: BlockValueInput) => setValues({ [name]: value }),
		setValues,
		setSource(next: string): EditorResult {
			return writeAttributes(latest.current, { value: next });
		},
		select() {
			const binding = latest.current;
			const located = locate(binding);
			if (!located) return;
			binding.editor.view.dispatch(
				binding.editor.state.tr.setSelection(NodeSelection.create(binding.editor.state.doc, located.pos)),
			);
		},
		focus: (target?: { readonly child?: number; readonly at?: "start" | "end" }) => focusInside(latest.current, target),
		remove(): EditorResult {
			const binding = latest.current;
			if (!isEditable(binding)) return readOnly();
			const located = locate(binding);
			if (!located) return detached();
			binding.editor
				.chain()
				.focus()
				.deleteRange({ from: located.pos, to: located.pos + located.node.nodeSize })
				.run();
			return { ok: true, value: undefined };
		},
		textAround(chars = 1500, marker = ""): string {
			const binding = latest.current;
			const located = locate(binding);
			const doc = binding.editor?.state?.doc;
			if (!located || !doc) return "";
			const before = doc.textBetween(Math.max(0, located.pos - chars), located.pos, "\n", " ");
			const after = doc.textBetween(
				located.pos + located.node.nodeSize,
				Math.min(doc.content.size, located.pos + located.node.nodeSize + chars),
				"\n",
				" ",
			);
			return `${before.trim()}\n${marker}\n${after.trim()}`;
		},
		addChild(init: BlockChildInit & { readonly focus?: boolean } = {}) {
			const { focus, ...childInit } = init;
			const result = runTransaction(latest.current, (tx) => ({ index: tx.addChild(childInit) }));
			if (result.ok && focus) focusInside(latest.current, { child: result.value.index });
			return result;
		},
		removeChild: (index: number) => runTransaction(latest.current, (tx) => tx.removeChild(index)),
		moveChild: (from: number, to: number) => runTransaction(latest.current, (tx) => tx.moveChild(from, to)),
		setChildValue: (index: number, name: string, value: BlockValueInput) =>
			runTransaction(latest.current, (tx) => tx.child(index).setValue(name, value)),
		transact: (run: (tx: BlockTransaction) => void) => runTransaction(latest.current, run),
	};
}

/** The child the cursor is in, or -1. -1 when the editor has no focus, so a cursor at the very start of a freshly opened entry does not count. */
function useFocusedChild(editor: Editor | null | undefined, getPos: NodeViewBinding["getPos"] | undefined) {
	const tracked = typeof editor?.on === "function" ? editor : null;
	const index = useEditorState({
		editor: tracked,
		selector: ({ editor: current }) => {
			const pos = getPos?.();
			if (!current?.isFocused || typeof pos !== "number") return -1;
			const parent = current.state.doc.nodeAt(pos);
			const { from } = current.state.selection;
			if (!parent || from <= pos || from >= pos + parent.nodeSize) return -1;
			let offset = pos + 1;
			for (let i = 0; i < parent.childCount; i += 1) {
				const end = offset + parent.child(i).nodeSize;
				if (from >= offset && from < end) return i;
				offset = end;
			}
			return -1;
		},
	});
	return index === null || index === undefined || index < 0 ? null : index;
}

/**
 * Gives a block view its {@link BlockEditor}. The node view renderer (`BlockNodeView`) wraps every block view in it; it is not part of the
 * public API. A test or a preview can wrap a view in it with the pieces of a node view.
 */
export function BlockEditorProvider({
	nodeView,
	definition,
	children,
}: {
	readonly nodeView: NodeViewBinding;
	readonly definition: BlockDefinition;
	readonly children: ReactNode;
}) {
	const { editor, node, getPos, updateAttributes, selected } = nodeView;
	const latest = useRef<Binding>({ editor, node, getPos, updateAttributes, selected, definition });
	latest.current = { editor, node, getPos, updateAttributes, selected, definition };
	const commands = useMemo(() => createCommands(latest), []);
	const editable = useEditorEditable(editor);
	const focusedChild = useFocusedChild(editor, getPos);

	const block = useMemo<BlockEditor>(() => {
		const count = node.childCount ?? 0;
		const isLeaf = node.type?.isLeaf ?? false;
		const min = definition.children?.min ?? 1;
		const max = definition.children?.max;
		const source = typeof node.attrs?.value === "string" ? node.attrs.value : undefined;
		let cachedChildren: readonly BlockChild[] | undefined;
		return {
			name: definition.name,
			definition,
			id: readId(node),
			values: readValues(node),
			source,
			editable,
			selected: Boolean(selected),
			focusedChild,
			get children() {
				cachedChildren ??= childrenOf(node);
				return cachedChildren;
			},
			canAddChild: editable && !isLeaf && (max === undefined || count < max),
			canRemoveChild: (index: number) =>
				editable && Number.isInteger(index) && index >= 0 && index < count && count > min,
			raw: { editor, node, getPos: getPos as () => number | undefined },
			...commands,
		};
	}, [node, selected, definition, editable, focusedChild, commands, editor, getPos]);

	return <BlockEditorContext.Provider value={block}>{children}</BlockEditorContext.Provider>;
}

// ---------------------------------------------------------------------------------------------------------------------------------
// Components

/** `NodeViewContent` with its element chosen by `as` at runtime (its own type fixes `as` to the element of the other props). */
const AnyElementContent = NodeViewContent as ComponentType<Record<string, unknown>>;

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
export function Content({ className, style, as, visibleChild, ...rest }: ContentProps) {
	const block = useBlockEditor();
	const scope = useId();
	if (block.raw.node.type?.isLeaf) {
		if (typeof process !== "undefined" && process.env.NODE_ENV !== "production")
			console.warn(`<Content> has no body to render: the "${block.name}" block has no content.`);
		return null;
	}
	const host = {
		...rest,
		as,
		className: cn(className),
		style,
		"data-cms-block-content": "",
		...(visibleChild === undefined ? {} : { "data-cms-content": scope }),
	};
	return (
		<>
			{visibleChild === undefined ? null : (
				// The children are ProseMirror nodes, so the index is applied with a selector: show child `visibleChild`, hide the rest.
				<style>{`[data-cms-content="${scope}"] > * > :not(:nth-child(${Math.max(0, Math.trunc(visibleChild)) + 1})) { display: none; }`}</style>
			)}
			<AnyElementContent {...host} />
		</>
	);
}

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
export function BlockFrame({
	as,
	ref,
	framed = true,
	selectedRing = true,
	className,
	children,
	...rest
}: BlockFrameProps) {
	const block = useBlockEditor();
	const isContainer = block.raw.node.type ? !block.raw.node.type.isLeaf : false;
	return (
		<NodeViewWrapper
			{...rest}
			as={as}
			ref={ref}
			data-cms-block-frame=""
			data-cms-framed={framed ? "" : undefined}
			data-cms-container-node={isContainer ? block.raw.node.type.name : undefined}
			className={cn(framed && "group/container relative", selectedRing && block.selected && SELECTED_RING, className)}
		>
			{children}
		</NodeViewWrapper>
	);
}
