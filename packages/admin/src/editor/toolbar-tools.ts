/**
 * Definitions of the formatting tools in the toolbar (block shapes, text styles, alignment, lists, block inserts)
 * and the order in which the toolbar places its entries.
 */

import {
	Asterisk,
	Code,
	DataTable,
	Heading,
	List,
	ListChecked,
	ListNumbered,
	Paragraph,
	Quotes,
	Subtract,
	TextAlignCenter,
	TextAlignLeft,
	TextAlignRight,
	TextClearFormat,
} from "@carbon/icons-react";
import type { Site } from "@monti-cms/core/site";
import type { Editor } from "@tiptap/core";
import type { TranslatorFor } from "../translator";
import { type EditorAllowance, OPEN_ALLOWANCE } from "./allowed";
import { canInsertFootnote, insertFootnote } from "./footnote-nodes";
import { INLINE_MARK_NAMES, inlineMarkTools } from "./inline-marks";
import type { editorMessages } from "./messages";
import type { ToolbarItem } from "./toolbar-button";
import type { ToolbarEntry } from "./toolbar-row";

export const chain = (editor: Editor) => editor.chain().focus();

/** Block shape dropdown. The current block's shape name becomes the dropdown name. */
export const BLOCK_STYLES = (
	t: TranslatorFor<typeof editorMessages>,
	allowance: EditorAllowance = OPEN_ALLOWANCE,
): ToolbarItem[] => [
	{
		label: t("toolbar.paragraph"),
		icon: Paragraph,
		isActive: (e) => e.isActive("paragraph"),
		run: (e) => chain(e).setParagraph().run(),
	},
	...([2, 3, 4] as const)
		.filter((level) => allowance.allowsHeading(level))
		.map((level) => ({
			label: `H${level}`,
			title: t("toolbar.heading", { level }),
			icon: { 2: Heading, 3: Heading, 4: Heading }[level],
			isActive: (e: Editor) => e.isActive("heading", { level }),
			run: (e: Editor) => chain(e).setHeading({ level }).run(),
		})),
];

/** Superscript/subscript marks, rarely used and grouped into one dropdown. */
const SCRIPT_MARKS = ["superscript", "subscript"];
export const inlineTools = (site: Site, allowance: EditorAllowance = OPEN_ALLOWANCE) =>
	inlineMarkTools(site).filter((tool) => !SCRIPT_MARKS.includes(tool.mark) && allowance.allowsMark(tool.mark));
export const scriptTools = (site: Site, allowance: EditorAllowance = OPEN_ALLOWANCE) =>
	inlineMarkTools(site).filter((tool) => SCRIPT_MARKS.includes(tool.mark) && allowance.allowsMark(tool.mark));
/** Order in which text-style buttons are hidden (largest first). Marks not listed get 5. Bold and italic are never hidden. */
export const INLINE_PRIORITY: Readonly<Record<string, number>> = {
	bold: 0,
	italic: 0,
	strike: 6,
	code: 4,
	underline: 5,
};
export const PINNED_INLINE_MARKS = ["bold", "italic"];

export const ALIGN_TOOLS = (t: TranslatorFor<typeof editorMessages>): ToolbarItem[] => [
	{
		label: t("toolbar.alignLeft"),
		title: t("toolbar.alignLeftTitle"),
		icon: TextAlignLeft,
		isActive: (e) => e.isActive({ textAlign: "left" }),
		run: (e) => chain(e).setTextAlign("left").run(),
	},
	{
		label: t("toolbar.alignCenter"),
		title: t("toolbar.alignCenterTitle"),
		icon: TextAlignCenter,
		isActive: (e) => e.isActive({ textAlign: "center" }),
		run: (e) => chain(e).setTextAlign("center").run(),
	},
	{
		label: t("toolbar.alignRight"),
		title: t("toolbar.alignRightTitle"),
		icon: TextAlignRight,
		isActive: (e) => e.isActive({ textAlign: "right" }),
		run: (e) => chain(e).setTextAlign("right").run(),
	},
	{
		label: t("toolbar.alignAuto"),
		title: t("toolbar.alignAutoTitle"),
		icon: TextClearFormat,
		run: (e) => chain(e).unsetTextAlign().run(),
	},
];

/** List dropdown. The current block's list type becomes the dropdown name and icon. */
export const LIST_STYLES = (
	t: TranslatorFor<typeof editorMessages>,
	allowance: EditorAllowance = OPEN_ALLOWANCE,
): ToolbarItem[] => [
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
		icon: ListNumbered,
		isActive: (e) => e.isActive("orderedList"),
		run: (e) => chain(e).toggleOrderedList().run(),
	},
	...(allowance.allowsBlock("taskList")
		? [
				{
					label: t("toolbar.todoLabel"),
					title: t("toolbar.todo"),
					icon: ListChecked,
					isActive: (e: Editor) => e.isActive("taskList"),
					run: (e: Editor) => chain(e).toggleTaskList().run(),
				},
			]
		: []),
];

/** Block insert buttons and the order they are hidden (largest first). Lists are 2, components are 4. */
export const INSERT_TOOLS = (
	t: TranslatorFor<typeof editorMessages>,
	allowance: EditorAllowance = OPEN_ALLOWANCE,
): { tool: ToolbarItem; priority: number }[] => {
	const tools: { block: string; tool: ToolbarItem; priority: number }[] = [
		{
			block: "blockquote",
			priority: 6,
			tool: {
				label: t("toolbar.quoteLabel"),
				title: t("toolbar.quote"),
				icon: Quotes,
				isActive: (e) => e.isActive("blockquote"),
				run: (e) => chain(e).toggleBlockquote().run(),
			},
		},
		{
			block: "codeBlock",
			priority: 3,
			tool: {
				label: t("toolbar.codeBlock"),
				icon: Code,
				isActive: (e) => e.isActive("codeBlock"),
				run: (e) => chain(e).toggleCodeBlock().run(),
			},
		},
		{
			block: "table",
			priority: 7,
			tool: {
				label: t("toolbar.table"),
				icon: DataTable,
				run: (e) => chain(e).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
			},
		},
	];
	return tools.filter((item) => allowance.allowsBlock(item.block));
};

/** Inline footnote reference (plus its definition at the end of the page), the same action as the slash command. */
export const FOOTNOTE_TOOL = (t: TranslatorFor<typeof editorMessages>): ToolbarItem => ({
	label: t("toolbar.footnote"),
	icon: Asterisk,
	isDisabled: (e) => !canInsertFootnote(e),
	run: (e) => {
		insertFootnote(e);
	},
});

export const DIVIDER_TOOL = (t: TranslatorFor<typeof editorMessages>): ToolbarItem => ({
	label: t("toolbar.divider"),
	icon: Subtract,
	run: (e) => chain(e).setHorizontalRule().run(),
});

/** Toolbar slot name for a text-style extension (`mark:<block name>`). */
export const markToolKey = (group: "format" | "link", name: string) => `mark-${group}:${name}`;

/**
 * Toolbar order. Paragraph shape → text styles (including extension styles) → attached to text (links, extension styles) → lists and alignment → block insert.
 * Document-level tools (templates, extensions, source, MDX, width) are placed on the right (`toolbarAside`) by the edit screen. Items not listed here are appended at the end in their original order.
 * `mark-format:*` and `mark-link:*` are in the order the extensions added them.
 */
const TOOLBAR_ORDER = (t: TranslatorFor<typeof editorMessages>) => [
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

export const orderToolbar = (
	t: TranslatorFor<typeof editorMessages>,
	entries: readonly ToolbarEntry[],
): ToolbarEntry[] => {
	const rank = (key: string) => {
		const group = /^(mark-(?:format|link)):/.exec(key)?.[1];
		const index = TOOLBAR_ORDER(t).indexOf(group ? `${group}:*` : key);
		return index < 0 ? TOOLBAR_ORDER(t).length : index;
	};
	// Keep the original order within the same slot (Array.prototype.sort is stable).
	return [...entries].sort((a, b) => rank(a.key) - rank(b.key));
};
