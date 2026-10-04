import { ADDED_BLOCKS, BLOCKS, createTranslator } from "@monti-cms/core/client";
import { Heading2, Heading3, Heading4, Image, Link2, List, ListOrdered, ListTodo, Minus, Paperclip, Pilcrow, Quote, SquareCode, Table2, } from "lucide-react";
import { BLOCK_INSERT_ACTIONS, OPEN_FILE_PICKER_EVENT, OPEN_IMAGE_DIALOG_EVENT, } from "./block-inserts.js";
import { editorMessages } from "./messages.js";
const t = createTranslator(editorMessages);
/** Search term list (dictionary values joined by commas). */
const keywordList = (key) => t(key)
    .split(",")
    .map((word) => word.trim());
export { OPEN_FILE_PICKER_EVENT, OPEN_IMAGE_DIALOG_EVENT } from "./block-inserts.js";
const HEADING_ICONS = { 2: Heading2, 3: Heading3, 4: Heading4 };
const heading = (level) => ({
    title: t(`slash.h${level}.title`),
    icon: HEADING_ICONS[level],
    description: t(`slash.h${level}.description`),
    keywords: [
        ...keywordList("slash.heading.keywords"),
        `h${level}`,
        `heading${level}`,
        ...keywordList(`slash.h${level}.keywords`),
    ],
    action: (editor, range) => {
        editor.chain().focus().deleteRange(range).toggleHeading({ level }).run();
    },
});
/**
 * Basic formatting and inline slash commands.
 */
export const BASE_SLASH_COMMANDS = [
    {
        title: t("slash.paragraph.title"),
        description: t("slash.paragraph.description"),
        icon: Pilcrow,
        keywords: keywordList("slash.paragraph.keywords"),
        action: (editor, range) => {
            editor.chain().focus().deleteRange(range).setParagraph().run();
        },
    },
    heading(2),
    heading(3),
    heading(4),
    {
        title: t("slash.bullet.title"),
        description: t("slash.bullet.description"),
        icon: List,
        keywords: keywordList("slash.bullet.keywords"),
        action: (editor, range) => {
            editor.chain().focus().deleteRange(range).toggleBulletList().run();
        },
    },
    {
        title: t("slash.ordered.title"),
        description: t("slash.ordered.description"),
        icon: ListOrdered,
        keywords: keywordList("slash.ordered.keywords"),
        action: (editor, range) => {
            editor.chain().focus().deleteRange(range).toggleOrderedList().run();
        },
    },
    {
        title: t("slash.todo.title"),
        description: t("slash.todo.description"),
        icon: ListTodo,
        keywords: keywordList("slash.todo.keywords"),
        action: (editor, range) => {
            editor.chain().focus().deleteRange(range).toggleTaskList().run();
        },
    },
    {
        title: t("slash.quote.title"),
        description: t("slash.quote.description"),
        icon: Quote,
        keywords: keywordList("slash.quote.keywords"),
        action: (editor, range) => {
            editor.chain().focus().deleteRange(range).toggleBlockquote().run();
        },
    },
    {
        title: t("slash.code.title"),
        description: t("slash.code.description"),
        icon: SquareCode,
        keywords: keywordList("slash.code.keywords"),
        action: (editor, range) => {
            editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
        },
    },
    {
        title: t("slash.table.title"),
        description: t("slash.table.description"),
        icon: Table2,
        keywords: keywordList("slash.table.keywords"),
        action: (editor, range) => {
            editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
        },
    },
    {
        title: t("slash.divider.title"),
        description: t("slash.divider.description"),
        icon: Minus,
        keywords: keywordList("slash.divider.keywords"),
        action: (editor, range) => {
            editor.chain().focus().deleteRange(range).setHorizontalRule().run();
        },
    },
    {
        title: t("slash.image.title"),
        description: t("slash.image.description"),
        icon: Image,
        keywords: keywordList("slash.image.keywords"),
        action: (editor, range) => {
            editor.chain().focus().deleteRange(range).run();
            window.dispatchEvent(new CustomEvent(OPEN_IMAGE_DIALOG_EVENT));
        },
    },
    {
        title: t("slash.file.title"),
        description: t("slash.file.description"),
        icon: Paperclip,
        keywords: keywordList("slash.file.keywords"),
        action: (editor, range) => {
            editor.chain().focus().deleteRange(range).run();
            window.dispatchEvent(new CustomEvent(OPEN_FILE_PICKER_EVENT));
        },
    },
    {
        title: t("slash.internalLink.title"),
        description: t("slash.internalLink.description"),
        icon: Link2,
        keywords: keywordList("slash.internalLink.keywords"),
        action: (editor, range) => {
            editor.chain().focus().deleteRange(range).insertContent("[[").run();
        },
    },
];
/** Slash menu block order: added blocks (block extensions, site settings) first, then core blocks (math, etc.). */
const MENU_BLOCKS = [
    ...ADDED_BLOCKS,
    ...BLOCKS.filter((block) => !ADDED_BLOCKS.includes(block)),
];
/**
 * Among block definitions (BLOCKS) with `editor.insertable === true` and `editor.view === 'node'`,
 * generates the slash command list for blocks with a registered insert action.
 */
export function buildBlockSlashCommands(definitions = MENU_BLOCKS, actions = BLOCK_INSERT_ACTIONS) {
    const items = [];
    for (const block of definitions) {
        if (block.editor.insertable !== true || block.editor.view !== "node")
            continue;
        // Added blocks have no editor name, so find the insert action by block name.
        const nodeView = block.editor.nodeView ?? block.name;
        // Images have an existing hardcoded item, so exclude duplicates
        if (nodeView === "image" || block.name === "image")
            continue;
        const action = actions[nodeView];
        if (!action)
            continue;
        items.push({
            id: nodeView,
            title: block.label,
            description: block.description ?? t("slash.blockDescription", { label: block.label }),
            keywords: block.editor.keywords ? [...block.editor.keywords] : [block.label, block.name],
            ...(block.editor.icon ? { icon: block.editor.icon } : {}),
            action,
        });
    }
    return items;
}
/** Block insertion items (core blocks after added blocks). */
const BLOCK_SLASH_COMMANDS = buildBlockSlashCommands();
/**
 * `/` block insertion menu. Searchable by Korean and English names.
 * The post title is the H1 above the body, so body headings start at H2.
 */
export const SLASH_COMMANDS = [...BASE_SLASH_COMMANDS, ...BLOCK_SLASH_COMMANDS];
/**
 * Slash menu items. `extra` are items added by edit view extensions (plugins) (appended after), and `inline` are items added by text decoration extensions
 * (after the basic text formatting items, before block items).
 */
export function filterCommands(query, extra = [], inline = []) {
    const commands = extra.length > 0 || inline.length > 0
        ? [...BASE_SLASH_COMMANDS, ...inline, ...BLOCK_SLASH_COMMANDS, ...extra]
        : SLASH_COMMANDS;
    if (!query)
        return commands;
    const clean = query.trim().toLowerCase();
    return commands.filter((cmd) => {
        if (cmd.title.toLowerCase().includes(clean))
            return true;
        if (cmd.description.toLowerCase().includes(clean))
            return true;
        return cmd.keywords.some((k) => k.toLowerCase().includes(clean));
    });
}
