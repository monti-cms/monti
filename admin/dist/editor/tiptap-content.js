import { createTranslator } from "@monti-cms/core/client";
import { TEXT_ALIGN_VALUES as ALIGN_VALUES, analyze, serialize, sortMarks, toDocument } from "@monti-cms/core/mdx";
import { ADDED_MARK_BY_EDITOR_NAME, ADDED_MARKS, addedMarkName, markAttrsOf } from "./added-marks.js";
import { PARENT_ONLY_TYPES } from "./blocks/added/index.js";
import { converterForCms, converterForTiptap } from "./converters/index.js";
import { asNumber, asString, brDirectiveNode } from "./converters/shared.js";
import { editorMessages } from "./messages.js";
const t = createTranslator(editorMessages);
/**
 * CmsNode <-> Tiptap JSONContent conversion. This is the visual editor's load/save path.
 *
 * - Load: MDX → `analyze` → `toDocument` → this module → Tiptap JSON.
 * - Save: Tiptap `getJSON()` → this module → CmsNode → `serialize` → MDX.
 *
 * Neither direction **drops data.** Blocks missing from the Tiptap schema (tables, math, charts, callouts, tabs,
 * JSX other than math, etc.) are kept as a read-only box holding the original MDX in `cmsOpaqueBlock`
 * (nodes are never silently deleted or turned into arbitrary HTML). A block is either entirely native or
 * entirely a box — part of a box is never lost.
 */
export const OPAQUE_BLOCK_NAME = "cmsOpaqueBlock";
/** Marks Tiptap can carry as-is. Added text styles (block extensions) are carried as marks built from the definition (`added-marks.ts`). */
const NATIVE_MARKS = new Set([
    "bold",
    "italic",
    "strike",
    "code",
    "link",
    "underline",
    "superscript",
    "subscript",
    // Translation notice text. It has no attributes, so it passes through by name.
    "untranslated",
]);
const MAPPABLE_MARKS = new Set([...NATIVE_MARKS, ...ADDED_MARKS.keys()]);
const TEXT_ALIGN_VALUES = new Set(ALIGN_VALUES);
/**
 * Builds a JSX node in the same shape as `jsxAttrs` in `to-document.ts`.
 * `{type: name, attrs: {spread props, name, attributes}}` — key order does not affect comparison.
 */
const jsxCmsNode = (name, record) => {
    const attributes = Object.entries(record)
        .filter(([, value]) => value !== undefined)
        .map(([attrName, value]) => ({ name: attrName, value: value }));
    return { type: name, attrs: { ...record, name, attributes } };
};
/** Wraps a subtree in a box. `source` is the subtree's stored string (re-parsed when converting back). */
const toOpaque = (node) => {
    const body = serialize({ type: "doc", content: [structuredClone(node)] }).trimEnd();
    const label = typeof node.attrs?.name === "string" && node.attrs.name.length > 0 ? node.attrs.name : node.type;
    return { type: OPAQUE_BLOCK_NAME, attrs: { source: body, label } };
};
const isMappableInline = (node) => {
    if (node.type === "text")
        return (node.marks ?? []).every((mark) => MAPPABLE_MARKS.has(mark.type));
    if (node.type === "hardBreak")
        return true;
    // `:br[]` arrives as `mdxJsx` (name=br) — shown as a real line break in the editor.
    if (node.type === "mdxJsx" && node.attrs?.name === "br")
        return true;
    // Images, math, and other JSX cannot sit inline, so the whole block goes into a box.
    return false;
};
/** Unordered list where every item is `- [ ]`/`- [x]`. */
const isTaskList = (node) => {
    const items = node.content ?? [];
    return (node.type === "bulletList" &&
        items.length > 0 &&
        items.every((item) => item.type === "listItem" &&
            typeof item.attrs?.checked === "boolean" &&
            (item.content ?? []).every((child) => isMappableBlock(child))));
};
const isMappableBlock = (node) => {
    // Parent-only blocks (a single tab or column) are invalid outside their parent. The parent converter validates its children directly.
    if (PARENT_ONLY_TYPES.has(node.type))
        return false;
    const converter = converterForCms(node.type, node);
    if (converter)
        return converter.isMappable(node, context);
    switch (node.type) {
        case "paragraph":
        case "heading":
            return (node.content ?? []).every(isMappableInline);
        case "blockquote":
        case "orderedList":
            return (node.content ?? []).every(isMappableBlock);
        case "bulletList":
            // If every item is a task item, edit it as a Tiptap task list. Mixed lists are kept as a box.
            return isTaskList(node) || (node.content ?? []).every(isMappableBlock);
        case "listItem":
            // Task items are converted only inside a task list (`isTaskList`). Task items in an ordered list are kept as a box.
            if (node.attrs?.checked != null)
                return false;
            return (node.content ?? []).every(isMappableBlock);
        case "horizontalRule":
            return true;
        case "TextAlign": {
            const align = asString(node.attrs?.align);
            const children = node.content ?? [];
            const only = children.length === 1 ? children[0] : undefined;
            return (!!align &&
                TEXT_ALIGN_VALUES.has(align) &&
                !!only &&
                (only.type === "paragraph" || only.type === "heading") &&
                isMappableBlock(only));
        }
        default:
            return false;
    }
};
const toTiptapMarks = (marks) => {
    if (!marks || marks.length === 0)
        return undefined;
    const out = [];
    for (const mark of marks) {
        const added = ADDED_MARKS.get(mark.type);
        if (added) {
            out.push({ type: addedMarkName(added.name), attrs: markAttrsOf(added, mark.attrs) });
            continue;
        }
        // isMappableInline has filtered these, so every mark here is native.
        if (mark.type === "link") {
            const href = asString(mark.attrs?.href) ?? "";
            const title = asString(mark.attrs?.title);
            out.push(title != null ? { type: "link", attrs: { href, title } } : { type: "link", attrs: { href } });
            continue;
        }
        const rest = mark.attrs && Object.keys(mark.attrs).length > 0 ? { attrs: { ...mark.attrs } } : {};
        out.push({ type: mark.type, ...rest });
    }
    return out.length > 0 ? out : undefined;
};
const inlineChildren = (nodes) => {
    const out = [];
    for (const node of nodes) {
        if (node.type === "text") {
            const marks = toTiptapMarks(node.marks);
            out.push(marks ? { type: "text", text: node.text ?? "", marks } : { type: "text", text: node.text ?? "" });
            continue;
        }
        if (node.type === "hardBreak" || (node.type === "mdxJsx" && node.attrs?.name === "br")) {
            out.push({ type: "hardBreak" });
            continue;
        }
        // Unreachable because isMappableInline has filtered. A box cannot sit inline,
        // so reaching this means the parent block decision was wrong — surface it instead of passing silently.
        throw new Error(t("tiptapContent.unmappableInline", { type: node.type }));
    }
    return out;
};
const withTextAlign = (node, content) => {
    const align = asString(node.attrs?.textAlign);
    if (align && TEXT_ALIGN_VALUES.has(align)) {
        content.attrs = { ...(content.attrs ?? {}), textAlign: align };
    }
    return content;
};
const blockToTiptap = (node) => {
    if (!isMappableBlock(node))
        return toOpaque(node);
    const converter = converterForCms(node.type, node);
    if (converter)
        return converter.toTiptap(node, context);
    switch (node.type) {
        case "paragraph":
            return withTextAlign(node, { type: "paragraph", content: inlineChildren(node.content ?? []) });
        case "heading": {
            const level = asNumber(node.attrs?.level) ?? 2;
            return withTextAlign(node, {
                type: "heading",
                attrs: { level },
                content: inlineChildren(node.content ?? []),
            });
        }
        case "blockquote":
            return { type: "blockquote", content: (node.content ?? []).map(blockToTiptap) };
        case "bulletList":
            if (isTaskList(node)) {
                return {
                    type: "taskList",
                    content: (node.content ?? []).map((item) => ({
                        type: "taskItem",
                        attrs: { checked: item.attrs?.checked === true },
                        content: (item.content ?? []).map(blockToTiptap),
                    })),
                };
            }
            return { type: "bulletList", content: (node.content ?? []).map(blockToTiptap) };
        case "orderedList": {
            const start = asNumber(node.attrs?.start);
            return {
                type: "orderedList",
                ...(start != null && start !== 1 ? { attrs: { start } } : {}),
                content: (node.content ?? []).map(blockToTiptap),
            };
        }
        case "listItem":
            return { type: "listItem", content: (node.content ?? []).map(blockToTiptap) };
        case "horizontalRule":
            return { type: "horizontalRule" };
        case "TextAlign": {
            const child = (node.content ?? [])[0];
            const converted = blockToTiptap(child);
            converted.attrs = { ...(converted.attrs ?? {}), textAlign: asString(node.attrs?.align) };
            return converted;
        }
        default:
            return toOpaque(node);
    }
};
/** MDX body → Tiptap JSON. Converts what it can even with parse errors (boxes hold the original source). */
export const cmsNodeToTiptap = (node) => {
    if (node.type === "doc") {
        return {
            type: "doc",
            content: (node.content ?? []).map((block) => {
                try {
                    return blockToTiptap(block);
                }
                catch {
                    // Even on a mapping bug the body is not dropped — keeping it as a box makes saving exact.
                    return toOpaque(block);
                }
            }),
        };
    }
    return blockToTiptap(node);
};
/** MDX body string → Tiptap JSON. For loading into the editor. */
export const mdxToTiptap = (source) => cmsNodeToTiptap(toDocument(analyze(source)));
const tiptapMarksToCms = (marks) => {
    const out = [];
    for (const mark of marks ?? []) {
        if (!mark || typeof mark.type !== "string")
            continue;
        const added = ADDED_MARK_BY_EDITOR_NAME.get(mark.type);
        if (added) {
            const attrs = markAttrsOf(added, mark.attrs);
            out.push(Object.keys(attrs).length > 0 ? { type: added.name, attrs } : { type: added.name });
            continue;
        }
        if (mark.type === "link") {
            const href = asString(mark.attrs?.href) ?? "";
            const title = asString(mark.attrs?.title);
            out.push(title != null ? { type: "link", attrs: { href, title } } : { type: "link", attrs: { href } });
            continue;
        }
        // Marks outside the Tiptap schema cannot appear in getJSON (defensive: dropped).
        if (NATIVE_MARKS.has(mark.type))
            out.push({ type: mark.type });
    }
    return sortMarks(out);
};
const tiptapInlineToCms = (nodes) => {
    const out = [];
    for (const node of nodes ?? []) {
        if (!node || typeof node.type !== "string")
            continue;
        if (node.type === "text") {
            const text = { type: "text", text: node.text ?? "" };
            const marks = tiptapMarksToCms(node.marks);
            if (marks.length > 0)
                text.marks = marks;
            out.push(text);
            continue;
        }
        if (node.type === "hardBreak") {
            out.push(brDirectiveNode());
            continue;
        }
        if (node.type === "image") {
            out.push(...tiptapBlockToCms(node));
        }
        // Inlines outside the schema cannot appear in getJSON (defensive: dropped).
    }
    return out;
};
const tiptapBlockToCms = (node) => {
    if (!node || typeof node.type !== "string")
        return [];
    const converter = converterForTiptap(node.type);
    if (converter)
        return converter.toCms(node, context);
    switch (node.type) {
        case "paragraph":
        case "text": {
            const block = node.type === "text"
                ? { type: "text", text: node.text ?? "" }
                : { type: "paragraph", content: tiptapInlineToCms(node.content) };
            if (node.type === "paragraph") {
                const align = asString(node.attrs?.textAlign);
                if (align && TEXT_ALIGN_VALUES.has(align)) {
                    return [{ ...jsxCmsNode("TextAlign", { align }), content: [block] }];
                }
            }
            return [block];
        }
        case "heading": {
            const block = {
                type: "heading",
                attrs: { level: asNumber(node.attrs?.level) ?? 2 },
                content: tiptapInlineToCms(node.content),
            };
            const align = asString(node.attrs?.textAlign);
            if (align && TEXT_ALIGN_VALUES.has(align)) {
                return [{ ...jsxCmsNode("TextAlign", { align }), content: [block] }];
            }
            return [block];
        }
        case "blockquote":
        case "bulletList":
        case "orderedList":
        case "listItem": {
            const children = (node.content ?? []).flatMap(tiptapBlockToCms);
            if (node.type === "blockquote")
                return [{ type: "blockquote", content: children }];
            if (node.type === "bulletList")
                return [{ type: "bulletList", content: children }];
            if (node.type === "listItem")
                return [{ type: "listItem", content: children }];
            const start = asNumber(node.attrs?.start);
            return [
                start != null && start !== 1
                    ? { type: "orderedList", attrs: { start }, content: children }
                    : { type: "orderedList", content: children },
            ];
        }
        case "taskList":
            return [
                {
                    type: "bulletList",
                    content: (node.content ?? []).map((item) => ({
                        type: "listItem",
                        attrs: { checked: item.attrs?.checked === true },
                        content: (item.content ?? []).flatMap(tiptapBlockToCms),
                    })),
                },
            ];
        case "horizontalRule":
            return [{ type: "horizontalRule" }];
        case "hardBreak":
            return [brDirectiveNode()];
        case OPAQUE_BLOCK_NAME: {
            const source = asString(node.attrs?.source) ?? "";
            if (!source)
                return [];
            return [...(toDocument(analyze(source)).content ?? [])];
        }
        default:
            // Nodes outside the Tiptap schema cannot appear in getJSON (defensive: dropped).
            return [];
    }
};
/** Recursive conversion functions passed to the converter registry (`./converters`). Placed after the function declarations, but calls happen at run time so this is safe. */
const context = {
    blockToTiptap: (node) => blockToTiptap(node),
    tiptapBlockToCms: (node) => tiptapBlockToCms(node),
    isMappableBlock: (node) => isMappableBlock(node),
    isMappableInline: (node) => isMappableInline(node),
    inlineToTiptap: (nodes) => inlineChildren(nodes),
    inlineToCms: (nodes) => tiptapInlineToCms(nodes),
};
/** Tiptap `getJSON()` → CmsNode. For saving. */
export const tiptapToCmsNode = (content) => {
    const children = Array.isArray(content?.content) ? content.content : [];
    return { type: "doc", content: children.flatMap(tiptapBlockToCms) };
};
/** Tiptap `getJSON()` → MDX body. For saving from the editor. */
export const tiptapToMdx = (content) => serialize(tiptapToCmsNode(content));
