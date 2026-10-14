/**
 * Definitions of the formatting tools in the toolbar (block shapes, text styles, alignment, lists, block inserts)
 * and the order in which the toolbar places its entries.
 */
import { AlignCenter, AlignLeft, AlignRight, Asterisk, Heading2, Heading3, Heading4, List, ListOrdered, ListTodo, Minus, Pilcrow, Quote, RemoveFormatting, SquareCode, Table2, } from "lucide-react";
import { OPEN_ALLOWANCE } from "./allowed.js";
import { canInsertFootnote, insertFootnote } from "./footnote-nodes.js";
import { INLINE_MARK_NAMES, inlineMarkTools } from "./inline-marks.js";
export const chain = (editor) => editor.chain().focus();
/** Block shape dropdown. The current block's shape name becomes the dropdown name. */
export const BLOCK_STYLES = (t, allowance = OPEN_ALLOWANCE) => [
    {
        label: t("toolbar.paragraph"),
        icon: Pilcrow,
        isActive: (e) => e.isActive("paragraph"),
        run: (e) => chain(e).setParagraph().run(),
    },
    ...[2, 3, 4]
        .filter((level) => allowance.allowsHeading(level))
        .map((level) => ({
        label: `H${level}`,
        title: t("toolbar.heading", { level }),
        icon: { 2: Heading2, 3: Heading3, 4: Heading4 }[level],
        isActive: (e) => e.isActive("heading", { level }),
        run: (e) => chain(e).setHeading({ level }).run(),
    })),
];
/** Superscript/subscript marks, rarely used and grouped into one dropdown. */
const SCRIPT_MARKS = ["superscript", "subscript"];
export const inlineTools = (site, allowance = OPEN_ALLOWANCE) => inlineMarkTools(site).filter((tool) => !SCRIPT_MARKS.includes(tool.mark) && allowance.allowsMark(tool.mark));
export const scriptTools = (site, allowance = OPEN_ALLOWANCE) => inlineMarkTools(site).filter((tool) => SCRIPT_MARKS.includes(tool.mark) && allowance.allowsMark(tool.mark));
/** Order in which text-style buttons are hidden (largest first). Marks not listed get 5. Bold and italic are never hidden. */
export const INLINE_PRIORITY = {
    bold: 0,
    italic: 0,
    strike: 6,
    code: 4,
    underline: 5,
};
export const PINNED_INLINE_MARKS = ["bold", "italic"];
export const ALIGN_TOOLS = (t) => [
    {
        label: t("toolbar.alignLeft"),
        title: t("toolbar.alignLeftTitle"),
        icon: AlignLeft,
        isActive: (e) => e.isActive({ textAlign: "left" }),
        run: (e) => chain(e).setTextAlign("left").run(),
    },
    {
        label: t("toolbar.alignCenter"),
        title: t("toolbar.alignCenterTitle"),
        icon: AlignCenter,
        isActive: (e) => e.isActive({ textAlign: "center" }),
        run: (e) => chain(e).setTextAlign("center").run(),
    },
    {
        label: t("toolbar.alignRight"),
        title: t("toolbar.alignRightTitle"),
        icon: AlignRight,
        isActive: (e) => e.isActive({ textAlign: "right" }),
        run: (e) => chain(e).setTextAlign("right").run(),
    },
    {
        label: t("toolbar.alignAuto"),
        title: t("toolbar.alignAutoTitle"),
        icon: RemoveFormatting,
        run: (e) => chain(e).unsetTextAlign().run(),
    },
];
/** List dropdown. The current block's list type becomes the dropdown name and icon. */
export const LIST_STYLES = (t, allowance = OPEN_ALLOWANCE) => [
    {
        label: t("toolbar.bulletLabel"),
        title: t("toolbar.bullet"),
        icon: List,
        isActive: (e) => e.isActive("bulletList"),
        run: (e) => chain(e).toggleBulletList().run(),
    },
    {
        label: t("toolbar.orderedLabel"),
        title: t("toolbar.ordered"),
        icon: ListOrdered,
        isActive: (e) => e.isActive("orderedList"),
        run: (e) => chain(e).toggleOrderedList().run(),
    },
    ...(allowance.allowsBlock("taskList")
        ? [
            {
                label: t("toolbar.todoLabel"),
                title: t("toolbar.todo"),
                icon: ListTodo,
                isActive: (e) => e.isActive("taskList"),
                run: (e) => chain(e).toggleTaskList().run(),
            },
        ]
        : []),
];
/** Block insert buttons and the order they are hidden (largest first). Lists are 2, components are 4. */
export const INSERT_TOOLS = (t, allowance = OPEN_ALLOWANCE) => {
    const tools = [
        {
            block: "blockquote",
            priority: 6,
            tool: {
                label: t("toolbar.quoteLabel"),
                title: t("toolbar.quote"),
                icon: Quote,
                isActive: (e) => e.isActive("blockquote"),
                run: (e) => chain(e).toggleBlockquote().run(),
            },
        },
        {
            block: "codeBlock",
            priority: 3,
            tool: {
                label: t("toolbar.codeBlock"),
                icon: SquareCode,
                isActive: (e) => e.isActive("codeBlock"),
                run: (e) => chain(e).toggleCodeBlock().run(),
            },
        },
        {
            block: "table",
            priority: 7,
            tool: {
                label: t("toolbar.table"),
                icon: Table2,
                run: (e) => chain(e).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
            },
        },
    ];
    return tools.filter((item) => allowance.allowsBlock(item.block));
};
/** Inline footnote reference (plus its definition at the end of the page), the same action as the slash command. */
export const FOOTNOTE_TOOL = (t) => ({
    label: t("toolbar.footnote"),
    icon: Asterisk,
    isDisabled: (e) => !canInsertFootnote(e),
    run: (e) => {
        insertFootnote(e);
    },
});
export const DIVIDER_TOOL = (t) => ({
    label: t("toolbar.divider"),
    icon: Minus,
    run: (e) => chain(e).setHorizontalRule().run(),
});
/** Toolbar slot name for a text-style extension (`mark:<block name>`). */
export const markToolKey = (group, name) => `mark-${group}:${name}`;
/**
 * Toolbar order. Paragraph shape → text styles (including extension styles) → attached to text (links, extension styles) → lists and alignment → block insert.
 * Document-level tools (templates, extensions, source, MDX, width) are placed on the right (`toolbarAside`) by the edit screen. Items not listed here are appended at the end in their original order.
 * `mark-format:*` and `mark-link:*` are in the order the extensions added them.
 */
const TOOLBAR_ORDER = (t) => [
    "block-style",
    "divider-block",
    ...INLINE_MARK_NAMES.filter((mark) => !SCRIPT_MARKS.includes(mark)),
    "mark-format:*",
    "script",
    "divider-inline",
    "link",
    "mark-link:*",
    FOOTNOTE_TOOL(t).label,
    "divider-list",
    "list",
    "align",
    "divider-insert",
    ...INSERT_TOOLS(t).map(({ tool }) => tool.label),
    "divider-tool",
    "upload",
    "custom-block",
];
export const orderToolbar = (t, entries) => {
    const rank = (key) => {
        const group = /^(mark-(?:format|link)):/.exec(key)?.[1];
        const index = TOOLBAR_ORDER(t).indexOf(group ? `${group}:*` : key);
        return index < 0 ? TOOLBAR_ORDER(t).length : index;
    };
    // Keep the original order within the same slot (Array.prototype.sort is stable).
    return [...entries].sort((a, b) => rank(a.key) - rank(b.key));
};
