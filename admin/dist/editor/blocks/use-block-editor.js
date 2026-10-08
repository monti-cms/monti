"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useSite } from "@monti-cms/core/client";
import { Fragment } from "@tiptap/pm/model";
import { NodeSelection, TextSelection } from "@tiptap/pm/state";
import { NodeViewContent, NodeViewWrapper, useEditorState } from "@tiptap/react";
import { createContext, useContext, useId, useMemo, useRef, } from "react";
import { editorFailure } from "../../hooks/result.js";
import { cn } from "../../lib/utils/cn.js";
import { allowanceOfState } from "../allowed-extension.js";
import { BLOCK_ID_ATTRIBUTE } from "../block-ids.js";
import { blockNodeName } from "./added/shared.js";
import { BlockIssueNotice } from "./block-issues.js";
import { childPos, SELECTED_RING, useEditorEditable, valuesOf, withValue } from "./block-model.js";
import { blocksMessages } from "./messages.js";
import { blockOfNode } from "./node-block.js";
const BlockEditorContext = createContext(null);
/**
 * The block the surrounding block view edits. Call it inside a component registered in `blockViews`; anywhere else it throws.
 *
 * @experimental
 */
export function useBlockEditor() {
    const block = useContext(BlockEditorContext);
    if (!block)
        throw new Error("useBlockEditor must be called inside a block view (a component registered in `blockViews`).");
    return block;
}
/** A failure that stops a transaction and becomes the result of the command. */
class BlockAbort extends Error {
    error;
    constructor(error) {
        super(error.message);
        this.error = error;
    }
}
const abort = (code, message) => new BlockAbort({ code, message, retryable: false });
/** Whether the block's attributes live in one `values` map (added blocks) or are flat node attributes (image, file, math). */
const hasValuesMap = (node) => node.attrs != null && "values" in node.attrs;
const typeHasValuesMap = (type) => Boolean(type.spec.attrs && "values" in type.spec.attrs);
/** Attributes that are not block values: the stored id and the source text of code blocks. */
const INTERNAL_ATTRIBUTES = new Set([BLOCK_ID_ATTRIBUTE, "value"]);
const readValues = (node) => {
    if (hasValuesMap(node))
        return valuesOf(node);
    const values = {};
    for (const [key, value] of Object.entries(node.attrs ?? {})) {
        if (INTERNAL_ATTRIBUTES.has(key))
            continue;
        if (typeof value === "string" || typeof value === "boolean")
            values[key] = value;
        else if (typeof value === "number")
            values[key] = String(value);
    }
    return values;
};
const readId = (node) => {
    const id = node.attrs?.[BLOCK_ID_ATTRIBUTE];
    return typeof id === "string" && id ? id : null;
};
const describeChild = (site, child, index) => ({
    index,
    id: readId(child),
    name: blockOfNode(site, child.type.name)?.name ?? child.type.name,
    values: readValues(child),
});
const childrenOf = (site, node) => {
    const children = [];
    node.forEach((child, _offset, index) => {
        children.push(describeChild(site, child, index));
    });
    return children;
};
/** The node's attributes after writing `patch`. Added blocks keep their values in one map; image and file store each value as given. */
const patchedAttributes = (node, patch) => {
    if (hasValuesMap(node)) {
        let values = valuesOf(node);
        for (const [name, value] of Object.entries(patch))
            values = withValue(values, name, value ?? "");
        return { ...node.attrs, values };
    }
    return { ...node.attrs, ...patch };
};
const isEditable = (binding) => binding.editor?.isEditable ?? true;
const readOnly = (binding) => editorFailure("read_only", binding.site.createTranslator(blocksMessages)("block.readOnly"));
const detached = (binding) => editorFailure("invalid_state", binding.site.createTranslator(blocksMessages)("block.detached"));
/** The block's node in the live document. Falls back to the rendered node when there is no editor state to read (a preview, a test). */
const locate = (binding) => {
    const pos = binding.getPos?.();
    if (typeof pos !== "number")
        return null;
    const doc = binding.editor?.state?.doc;
    if (!doc)
        return { node: binding.node, pos };
    const node = doc.nodeAt(pos);
    return node && node.type === binding.node.type ? { node, pos } : null;
};
function createTransaction(binding, tr, pos) {
    const { definition, site } = binding;
    const t = site.createTranslator(blocksMessages);
    const current = () => {
        const node = tr.doc.nodeAt(pos);
        if (!node)
            throw abort("invalid_state", t("block.detached"));
        return node;
    };
    const childAt = (parent, index) => {
        const child = Number.isInteger(index) ? parent.maybeChild(index) : null;
        if (!child)
            throw abort("invalid_state", t("block.childRange", { label: definition.label, index: index + 1 }));
        return child;
    };
    const minChildren = definition.children?.min ?? 1;
    const maxChildren = definition.children?.max;
    const childType = (name) => {
        const target = name ?? definition.children?.blocks?.[0];
        if (!target)
            throw abort("invalid_state", t("block.noChildren", { label: definition.label }));
        const { nodes } = tr.doc.type.schema;
        const type = nodes[target] ?? nodes[blockNodeName({ name: target })];
        if (!type)
            throw abort("invalid_state", t("block.unknownChild", { label: definition.label, name: target }));
        return type;
    };
    const setValues = (patch) => {
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
            return childrenOf(site, current());
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
            if (parent.type.isLeaf)
                throw abort("invalid_state", t("block.noChildren", { label: definition.label }));
            if (maxChildren !== undefined && parent.childCount >= maxChildren)
                throw abort("limit", t("block.childMax", { label: definition.label, count: maxChildren }));
            const type = childType(init.name);
            // A child that is body content (a code block) is a block of the body's allowed list too; a child block (a tab) goes with its parent.
            if (binding.editor?.state && !allowanceOfState(binding.editor.state).allowsNode(type.name))
                throw abort("invalid_state", t("block.childNotAllowed", { label: definition.label, name: init.name ?? type.name }));
            const index = typeof init.at === "number" ? Math.min(Math.max(Math.trunc(init.at), 0), parent.childCount) : parent.childCount;
            if (!parent.canReplaceWith(index, index, type))
                throw abort("invalid_state", t("block.unknownChild", { label: definition.label, name: init.name ?? type.name }));
            const values = Object.entries(init.values ?? {});
            const attrs = typeHasValuesMap(type)
                ? { values: values.reduce((all, [name, value]) => withValue(all, name, value ?? ""), {}) }
                : Object.fromEntries(values);
            const child = type.createAndFill(attrs);
            if (!child)
                throw abort("invalid_state", t("block.childFailed"));
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
            if (from === to)
                return;
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
            const owner = selection instanceof TextSelection
                ? Array.from({ length: last - first + 1 }, (_, offset) => first + offset).find((index) => childPos(parent, pos, index) <= selection.from && selection.to <= childPos(parent, pos, index + 1))
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
function runTransaction(binding, run) {
    if (!isEditable(binding))
        return readOnly(binding);
    const located = locate(binding);
    if (!located)
        return detached(binding);
    const { editor } = binding;
    const tr = editor.state.tr;
    try {
        const value = run(createTransaction(binding, tr, located.pos));
        if (tr.docChanged)
            editor.view.dispatch(tr);
        return { ok: true, value };
    }
    catch (error) {
        if (error instanceof BlockAbort)
            return { ok: false, error: error.error };
        throw error;
    }
}
/** Writes node attributes through the node view. Used for flat attributes (image, file, math, code fences) and the source text. */
function writeAttributes(binding, attributes) {
    if (!isEditable(binding))
        return readOnly(binding);
    try {
        binding.updateAttributes(attributes);
    }
    catch {
        // The node left the document (an edit still pending while the view unmounts), so there is nowhere to write.
        return detached(binding);
    }
    return { ok: true, value: undefined };
}
/** Moves the cursor into the block: a child (or the block's own start) and its start or end. */
function focusInside(binding, target = {}) {
    const pos = binding.getPos?.();
    if (typeof pos !== "number")
        return;
    const end = target.at === "end";
    binding.editor
        .chain()
        .focus()
        .command(({ tr }) => {
        const parent = tr.doc.nodeAt(pos);
        if (!parent)
            return false;
        let inside;
        if (target.child === undefined) {
            inside = end ? pos + parent.nodeSize - 1 : pos + 1;
        }
        else {
            const child = parent.maybeChild(target.child);
            if (!child)
                return false;
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
function createCommands(latest) {
    const setValues = (patch) => {
        const binding = latest.current;
        if (!hasValuesMap(binding.node))
            return writeAttributes(binding, patch);
        return runTransaction(binding, (tx) => tx.setValues(patch));
    };
    return {
        setValue: (name, value) => setValues({ [name]: value }),
        setValues,
        setSource(next) {
            return writeAttributes(latest.current, { value: next });
        },
        select() {
            const binding = latest.current;
            const located = locate(binding);
            if (!located)
                return;
            binding.editor.view.dispatch(binding.editor.state.tr.setSelection(NodeSelection.create(binding.editor.state.doc, located.pos)));
        },
        focus: (target) => focusInside(latest.current, target),
        remove() {
            const binding = latest.current;
            if (!isEditable(binding))
                return readOnly(binding);
            const located = locate(binding);
            if (!located)
                return detached(binding);
            binding.editor
                .chain()
                .focus()
                .deleteRange({ from: located.pos, to: located.pos + located.node.nodeSize })
                .run();
            return { ok: true, value: undefined };
        },
        textAround(chars = 1500, marker = "") {
            const binding = latest.current;
            const located = locate(binding);
            const doc = binding.editor?.state?.doc;
            if (!located || !doc)
                return "";
            const before = doc.textBetween(Math.max(0, located.pos - chars), located.pos, "\n", " ");
            const after = doc.textBetween(located.pos + located.node.nodeSize, Math.min(doc.content.size, located.pos + located.node.nodeSize + chars), "\n", " ");
            return `${before.trim()}\n${marker}\n${after.trim()}`;
        },
        addChild(init = {}) {
            const { focus, ...childInit } = init;
            const result = runTransaction(latest.current, (tx) => ({ index: tx.addChild(childInit) }));
            if (result.ok && focus)
                focusInside(latest.current, { child: result.value.index });
            return result;
        },
        removeChild: (index) => runTransaction(latest.current, (tx) => tx.removeChild(index)),
        moveChild: (from, to) => runTransaction(latest.current, (tx) => tx.moveChild(from, to)),
        setChildValue: (index, name, value) => runTransaction(latest.current, (tx) => tx.child(index).setValue(name, value)),
        transact: (run) => runTransaction(latest.current, run),
    };
}
/** The child the cursor is in, or -1. -1 when the editor has no focus, so a cursor at the very start of a freshly opened entry does not count. */
function useFocusedChild(editor, getPos) {
    const tracked = typeof editor?.on === "function" ? editor : null;
    const index = useEditorState({
        editor: tracked,
        selector: ({ editor: current }) => {
            const pos = getPos?.();
            if (!current?.isFocused || typeof pos !== "number")
                return -1;
            const parent = current.state.doc.nodeAt(pos);
            const { from } = current.state.selection;
            if (!parent || from <= pos || from >= pos + parent.nodeSize)
                return -1;
            let offset = pos + 1;
            for (let i = 0; i < parent.childCount; i += 1) {
                const end = offset + parent.child(i).nodeSize;
                if (from >= offset && from < end)
                    return i;
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
export function BlockEditorProvider({ nodeView, definition, children, }) {
    const { editor, node, getPos, updateAttributes, selected } = nodeView;
    const site = useSite();
    const latest = useRef({ editor, node, getPos, updateAttributes, selected, definition, site });
    latest.current = { editor, node, getPos, updateAttributes, selected, definition, site };
    const commands = useMemo(() => createCommands(latest), []);
    const editable = useEditorEditable(editor);
    const focusedChild = useFocusedChild(editor, getPos);
    const block = useMemo(() => {
        const count = node.childCount ?? 0;
        const isLeaf = node.type?.isLeaf ?? false;
        const min = definition.children?.min ?? 1;
        const max = definition.children?.max;
        const source = typeof node.attrs?.value === "string" ? node.attrs.value : undefined;
        let cachedChildren;
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
                cachedChildren ??= childrenOf(site, node);
                return cachedChildren;
            },
            canAddChild: editable && !isLeaf && (max === undefined || count < max),
            canRemoveChild: (index) => editable && Number.isInteger(index) && index >= 0 && index < count && count > min,
            raw: { editor, node, getPos: getPos },
            ...commands,
        };
    }, [node, selected, definition, editable, focusedChild, commands, editor, getPos, site]);
    return _jsx(BlockEditorContext.Provider, { value: block, children: children });
}
// ---------------------------------------------------------------------------------------------------------------------------------
// Components
/** `NodeViewContent` with its element chosen by `as` at runtime (its own type fixes `as` to the element of the other props). */
const AnyElementContent = NodeViewContent;
/**
 * The editable nested body of a container block: the place where the block's children are edited in the document. It replaces the Tiptap
 * node view content. A block without a body (image, math) renders nothing.
 *
 * DOM contract: the element has `data-cms-block-content`, and the child blocks are inside its first child element
 * (`[data-cms-block-content] > *` holds them), so a view can lay them out with `[&>*]:grid` or `[&>*>:first-child]:mt-0`.
 *
 * @experimental
 */
export function Content({ className, style, as, visibleChild, ...rest }) {
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
    return (_jsxs(_Fragment, { children: [visibleChild === undefined ? null : (_jsx("style", { children: `[data-cms-content="${scope}"] > * > :not(:nth-child(${Math.max(0, Math.trunc(visibleChild)) + 1})) { display: none; }` })), _jsx(AnyElementContent, { ...host })] }));
}
/**
 * The outer element of a block view: the editor's node view wrapper plus the standard frame (selected ring, hover scope, the attributes
 * the editor relies on). Every block view renders one around its content.
 *
 * @experimental
 */
export function BlockFrame({ as, ref, framed = true, selectedRing = true, className, children, ...rest }) {
    const block = useBlockEditor();
    const isContainer = block.raw.node.type ? !block.raw.node.type.isLeaf : false;
    return (_jsxs(NodeViewWrapper, { ...rest, as: as, ref: ref, "data-cms-block-frame": "", "data-cms-framed": framed ? "" : undefined, "data-cms-container-node": isContainer ? block.raw.node.type.name : undefined, className: cn(framed && "group/container relative", selectedRing && block.selected && SELECTED_RING, className), children: [children, _jsx(BlockIssueNotice, { blockId: block.id })] }));
}
