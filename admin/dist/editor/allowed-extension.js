import { Extension, textblockTypeInputRule } from "@tiptap/core";
import { Fragment, Slice } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { OPEN_ALLOWANCE } from "./allowed.js";
/**
 * How the editor keeps to the allowed list of a body (`allowed.ts`). Four parts, all reading the same {@link EditorAllowance}:
 *
 * 1. {@link restrictExtensions} takes the input rules, paste rules and keyboard shortcuts away from every node and mark the list does not allow, so
 *    typing `> ` or pressing a shortcut does not add one. The nodes and marks stay in the schema, so a body that holds them still opens.
 * 2. The guard plugin refuses a change that **introduces** a disallowed type the editor's document does not hold yet (a command, a drop, anything that got
 *    past the parts above). A type already in the document can still be edited, moved, duplicated and deleted. Undo and redo are never refused.
 * 3. Paste is cleaned before it is inserted ({@link cleanSlice}): a block that is not allowed becomes its text in paragraphs, a mark that is not allowed
 *    is dropped from the text. The text is kept; only the form changes. A paste never brings in a disallowed block, even one the document already holds.
 * 4. The toolbar, the slash menu and the insert menus read the same allowance and do not list what is not allowed (`tiptap-editor.tsx`).
 */
/** The allowance an editor was built with: `editor.state` carries it so tools that only get the state can read it. */
export const allowedKey = new PluginKey("cmsAllowed");
/** The allowance of an editor state (everything allowed when the editor has none). */
export const allowanceOfState = (state) => allowedKey.getState(state) ?? OPEN_ALLOWANCE;
/** Set on a transaction that replaces the whole body with stored content (opening an entry, applying a template): what is stored is never refused. */
export const ALLOWED_BYPASS_META = "cmsAllowedBypass";
/** The disallowed types a document holds, by key (`block:table`, `mark:bold`, `block:heading:4`). */
const disallowedTypes = (doc, allowance) => {
    const found = new Set();
    doc.descendants((node) => {
        if (node.isText) {
            for (const mark of node.marks) {
                const name = allowance.markOfEditorMark(mark.type.name);
                if (name !== undefined && !allowance.allowsMark(name))
                    found.add(`mark:${name}`);
            }
            return false;
        }
        // Alignment is an attribute of a paragraph or heading in the editor (a `text-align` block when stored).
        if (node.attrs.textAlign && !allowance.allowsBlock("text-align"))
            found.add("block:text-align");
        if (node.type.name === "heading") {
            const level = Number(node.attrs.level);
            if (!allowance.allowsHeading(level))
                found.add(`block:heading:${level}`);
            return true;
        }
        const block = allowance.blockOfNode(node.type.name);
        if (block !== undefined && !allowance.allowsBlock(block))
            found.add(`block:${block}`);
        return true;
    });
    return found;
};
/**
 * A copy of an extension with some of its fields replaced. `extend` would make the extension its own parent, so a field that calls `this.parent` (the plugins of
 * the code block, the attributes of the table) would run twice; the copy keeps the parent of the original instead, the way `configure` does.
 */
const withFields = (extension, fields) => {
    const copy = extension.extend(fields);
    copy.parent = extension.parent;
    extension.child = null;
    return copy;
};
/** Tools that add content without the editor's rules in the way: used to take them from an extension. */
const NO_RULES = {
    addInputRules: () => [],
    addPasteRules: () => [],
    addKeyboardShortcuts: () => ({}),
};
const MAX_HEADING_LEVEL = 6;
/** A heading extension that types and binds only the levels the list allows. */
const restrictHeading = (extension, allowance) => {
    const levels = Array.from({ length: MAX_HEADING_LEVEL }, (_, index) => index + 1).filter((level) => allowance.allowsHeading(level));
    if (levels.length === MAX_HEADING_LEVEL)
        return extension;
    if (levels.length === 0)
        return withFields(extension, NO_RULES);
    return withFields(extension, {
        addInputRules() {
            return levels.map((level) => textblockTypeInputRule({
                find: new RegExp(`^(#{${level}})\\s$`),
                type: this.type,
                getAttributes: { level },
            }));
        },
        addKeyboardShortcuts() {
            return Object.fromEntries(levels.map((level) => [
                `Mod-Alt-${level}`,
                () => this.editor.commands.toggleHeading({ level }),
            ]));
        },
    });
};
/**
 * The extensions with the input rules, paste rules and shortcuts of what the list does not allow taken away. The list a site's StarterKit brings is
 * restricted inside it. With no limit the same extensions come back, so an editor without a list is exactly what it was.
 */
export function restrictExtensions(extensions, allowance) {
    if (!allowance.limited)
        return [...extensions];
    return extensions.map((extension) => restricted(extension, allowance));
}
/** The same restricted extension for the same extension and allowance, so an editor rebuilt on every render keeps its extensions. */
const restrictedCache = new WeakMap();
function restricted(extension, allowance) {
    let byAllowance = restrictedCache.get(extension);
    if (!byAllowance) {
        byAllowance = new WeakMap();
        restrictedCache.set(extension, byAllowance);
    }
    let result = byAllowance.get(allowance);
    if (!result) {
        result = restrictOne(extension, allowance);
        byAllowance.set(allowance, result);
    }
    return result;
}
function restrictOne(extension, allowance) {
    if (extension.name === "starterKit") {
        return extension.extend({
            addExtensions() {
                const parent = this.parent?.() ?? [];
                return restrictExtensions(parent, allowance);
            },
        });
    }
    if (extension.name === "heading")
        return restrictHeading(extension, allowance);
    const allowed = extension.type === "mark" ? allowance.allowsEditorMark(extension.name) : allowance.allowsNode(extension.name);
    return allowed ? extension : withFields(extension, NO_RULES);
}
const text = (value) => (typeof value === "string" ? value : "");
/** What a block that cannot be inserted as it is says in words: the source of a formula, the description of an image, the name of a file. */
const wordsOf = (node) => {
    switch (node.type.name) {
        case "cmsMath":
            return text(node.attrs.value);
        case "image":
            return text(node.attrs.alt) || text(node.attrs.caption);
        case "cmsFile":
            return text(node.attrs.label);
        default:
            return "";
    }
};
/** The mark kept only when the list allows it. */
const keptMarks = (marks, allowance) => marks.filter((mark) => allowance.allowsEditorMark(mark.type.name));
/**
 * A pasted fragment in the form the list allows. A block that is not allowed is not inserted; its text is: a text block becomes a paragraph, a container
 * gives its children (a table, quote or callout becomes the paragraphs inside it), and a block with only an attribute for content says it in words (a
 * formula its source, an image its description) or leaves nothing. A mark that is not allowed is dropped from the text. Nothing else changes.
 */
export function cleanFragment(fragment, allowance, schema) {
    const paragraph = schema.nodes.paragraph;
    const out = [];
    const nodesOf = (content) => [...content.content];
    const clean = (node) => {
        if (node.isText) {
            const marks = keptMarks(node.marks, allowance);
            return [marks.length === node.marks.length ? node : node.mark(marks)];
        }
        // A box holding a stored node is not a block of the list.
        if (node.type.name === "cmsOpaqueBlock")
            return [node];
        const block = allowance.blockOfNode(node.type.name);
        const heading = node.type.name === "heading";
        const allowed = heading
            ? allowance.allowsHeading(Number(node.attrs.level))
            : block === undefined || allowance.allowsBlock(block);
        const content = node.content.size > 0 ? cleanFragment(node.content, allowance, schema) : node.content;
        if (allowed) {
            if (!node.type.validContent(content))
                return nodesOf(content);
            // A pasted alignment goes with the `text-align` block: without it the text keeps no alignment.
            const align = node.attrs.textAlign && !allowance.allowsBlock("text-align");
            return [align ? node.type.create({ ...node.attrs, textAlign: null }, content, node.marks) : node.copy(content)];
        }
        if (node.isInline)
            return [];
        if (node.isTextblock)
            return paragraph ? [paragraph.create(null, content)] : nodesOf(content);
        if (node.isLeaf) {
            const words = wordsOf(node);
            return words && paragraph ? [paragraph.create(null, schema.text(words))] : [];
        }
        return nodesOf(content);
    };
    fragment.forEach((node) => {
        out.push(...clean(node));
    });
    return Fragment.fromArray(out);
}
/** How many levels a slice can be open at its start (`start`) or end: the nesting of the first (last) blocks, down to the first text block. */
const openDepth = (fragment, side) => {
    let depth = 0;
    let node = side === "start" ? fragment.firstChild : fragment.lastChild;
    while (node && !node.isLeaf) {
        depth += 1;
        if (node.inlineContent)
            break;
        node = side === "start" ? node.firstChild : node.lastChild;
    }
    return depth;
};
/** A pasted slice in the form the list allows (see {@link cleanFragment}). The same slice when it holds nothing the list refuses. */
export function cleanSlice(slice, allowance, schema) {
    const content = cleanFragment(slice.content, allowance, schema);
    if (content.eq(slice.content))
        return slice;
    return new Slice(content, Math.min(slice.openStart, openDepth(content, "start")), Math.min(slice.openEnd, openDepth(content, "end")));
}
/**
 * The extension that holds the allowance: it keeps it in the editor state, refuses a change that introduces a disallowed type, and cleans what is pasted.
 * Without a limit it is not added.
 */
export const cmsAllowedGuard = (allowance) => {
    const known = guards.get(allowance);
    if (known)
        return known;
    const guard = createGuard(allowance);
    guards.set(allowance, guard);
    return guard;
};
const guards = new WeakMap();
const createGuard = (allowance) => Extension.create({
    name: "cmsAllowed",
    addProseMirrorPlugins() {
        if (!allowance.limited)
            return [];
        return [
            new Plugin({
                key: allowedKey,
                state: { init: () => allowance, apply: (_tr, value) => value },
                filterTransaction: (tr, state) => {
                    if (!tr.docChanged || tr.getMeta(ALLOWED_BYPASS_META) || tr.getMeta("history$") !== undefined)
                        return true;
                    const after = disallowedTypes(tr.doc, allowance);
                    if (after.size === 0)
                        return true;
                    const before = disallowedTypes(state.doc, allowance);
                    for (const key of after)
                        if (!before.has(key))
                            return false;
                    return true;
                },
                props: {
                    transformPasted: (slice, view) => 
                    // Moving blocks inside the editor (a drag) is not a paste: what the document holds goes where it is dropped.
                    view.dragging ? slice : cleanSlice(slice, allowance, view.state.schema),
                },
            }),
        ];
    },
});
