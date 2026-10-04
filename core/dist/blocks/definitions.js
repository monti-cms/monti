import { createActiveTranslator } from "../i18n/active.js";
import { defineBlock } from "./define.js";
import { blockMessages } from "./messages.js";
/**
 * Core block definitions. Includes only blocks that other features rely on or that use Markdown syntax. Blocks like callouts and tabs, and text marks like tooltips, code links, and text color,
 * are added as plugins by the block extension (`@monti-cms/blocks`), and sites add them through `blocks` in the config (`blocks/resolve.ts`).
 * When adding or changing a block, also check the public renderer and editor registries (the definition test catches omissions).
 */
/**
 * Labels and descriptions are picked from the dictionary (`messages.ts`) when read (getter). This file is a module the config file reads, so it cannot read the site config
 * (circular); the UI language is supplied by `i18n/active.ts`. Definitions remain JSON-serializable (getters are stored as values).
 */
const t = createActiveTranslator(blockMessages);
/** Attaches a label (`label`) and description (`description`) picked from the dictionary to `base`. Keys are `<prefix>.label` and `<prefix>.description`. */
function withText(base, prefix, props) {
    const result = { ...base };
    for (const prop of props) {
        Object.defineProperty(result, prop, { get: () => t(`${prefix}.${prop}`), enumerable: true });
    }
    return result;
}
/** Slash menu search terms: the English name (searchable regardless of language) + dictionary terms (comma-separated). */
const keywordsOf = (key, ...base) => [
    ...base,
    ...t(key)
        .split(",")
        .map((word) => word.trim())
        .filter(Boolean),
];
const ALIGN_OPTIONS = {
    get left() {
        return t("option.left");
    },
    get center() {
        return t("option.center");
    },
    get right() {
        return t("option.right");
    },
};
const ROTATE_OPTIONS = { "0": "0°", "90": "90°", "180": "180°", "270": "270°" };
export const textAlign = defineBlock(withText({
    name: "text-align",
    syntax: { kind: "container", directive: "text-align" },
    component: "TextAlign",
    // `justify` is not used. The public renderer supports only three values with fixed classes.
    attributes: {
        align: withText({ type: "string", required: true, options: ALIGN_OPTIONS }, "text-align.align", [
            "label",
        ]),
    },
    translateInside: true,
    editor: { view: "attribute" },
}, "text-align", ["label"]));
export const image = defineBlock(withText({
    name: "image",
    syntax: { kind: "leaf", directive: "image" },
    component: "Image",
    attributes: {
        mediaId: withText({ type: "string" }, "image.mediaId", ["label", "description"]),
        src: withText({ type: "string" }, "image.src", ["label"]),
        alt: withText({ type: "string", translatable: true }, "image.alt", ["label", "description"]),
        width: withText({ type: "string" }, "image.width", ["label", "description"]),
        align: withText({ type: "string", options: ALIGN_OPTIONS }, "image.align", ["label"]),
        caption: withText({ type: "string", translatable: true }, "image.caption", ["label"]),
        decorative: withText({ type: "boolean", defaultValue: false }, "image.decorative", ["label"]),
        crop: withText({ type: "string" }, "image.crop", ["label", "description"]),
        rotate: withText({ type: "string", options: ROTATE_OPTIONS }, "image.rotate", [
            "label",
            "description",
        ]),
        title: withText({ type: "string", translatable: true }, "image.title", ["label", "description"]),
    },
    editor: {
        view: "node",
        nodeView: "image",
        insertable: true,
        get keywords() {
            return keywordsOf("image.keywords", "image");
        },
    },
}, "image", ["label"]));
/**
 * Attachment file card (`::file{mediaId="…" label="report.pdf"}`). The public view shows the name, size, type, and a download link.
 * If `label` is empty, the uploaded file name is used.
 */
export const file = defineBlock(withText({
    name: "file",
    syntax: { kind: "leaf", directive: "file" },
    component: "File",
    attributes: {
        mediaId: withText({ type: "string", required: true }, "file.mediaId", ["label"]),
        label: withText({ type: "string", translatable: true }, "file.label", ["label"]),
    },
    editor: {
        view: "node",
        nodeView: "file",
        insertable: false,
        get keywords() {
            return keywordsOf("file.keywords", "file");
        },
    },
}, "file", ["label"]));
const textMark = (name) => defineBlock(withText({
    name,
    syntax: { kind: "text", directive: name },
    component: name,
    attributes: {},
    editor: { view: "mark" },
}, name, ["label"]));
/**
 * Untranslated notice text (`:untranslated[source text]`). A new translation wraps the source text with this marker. The editor shows it dimmed
 * and removes it when something is typed in that block. It is not shown in the public view, and the pre-publish check reports it if it remains.
 */
export const untranslated = defineBlock(withText({
    name: "untranslated",
    syntax: { kind: "text", directive: "untranslated" },
    component: "Untranslated",
    attributes: {},
    editor: { view: "mark" },
}, "untranslated", ["label"]));
export const underline = textMark("u");
export const superscript = textMark("sup");
export const subscript = textMark("sub");
export const lineBreak = textMark("br");
export const math = defineBlock(withText({
    name: "math",
    syntax: { kind: "math" },
    component: "Math",
    renderedBy: "rehype-katex",
    attributes: {},
    editor: {
        view: "node",
        nodeView: "math",
        insertable: true,
        get keywords() {
            return keywordsOf("math.keywords", "math", "katex");
        },
        icon: "sigma",
    },
}, "math", ["label", "description"]));
export const table = defineBlock(withText({
    name: "table",
    syntax: { kind: "container", directive: "table" },
    component: "Table",
    attributes: {
        align: withText({ type: "string" }, "table.align", ["label", "description"]),
        widths: withText({ type: "string" }, "table.widths", ["label", "description"]),
    },
    children: { blocks: ["row"], min: 1 },
    editor: {
        view: "opaque",
        insertable: false,
        get keywords() {
            return keywordsOf("table.keywords", "table");
        },
    },
}, "table", ["label", "description"]));
export const row = defineBlock(withText({
    name: "row",
    syntax: { kind: "container", directive: "row" },
    component: "TableRow",
    attributes: {},
    children: { blocks: ["cell"], min: 1 },
    parent: "table",
    editor: { view: "opaque" },
}, "row", ["label"]));
export const cell = defineBlock(withText({
    name: "cell",
    syntax: { kind: "leaf", directive: "cell" },
    component: "TableCell",
    attributes: {
        colspan: withText({ type: "string" }, "cell.colspan", ["label"]),
        rowspan: withText({ type: "string" }, "cell.rowspan", ["label"]),
        header: withText({ type: "boolean", defaultValue: false }, "cell.header", ["label"]),
    },
    parent: "row",
    editor: { view: "opaque" },
}, "cell", ["label"]));
/** Core blocks. Declaration order is the order in `/meta` and the docs. The blocks the site uses are `BLOCKS` in `blocks/active.ts`. */
export const BUILTIN_BLOCKS = [
    textAlign,
    image,
    file,
    untranslated,
    underline,
    superscript,
    subscript,
    lineBreak,
    math,
    table,
    row,
    cell,
];
