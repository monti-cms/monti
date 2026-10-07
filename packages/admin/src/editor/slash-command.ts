import { type BlockDefinition, perSite, type Site } from "@monti-cms/core/client";
import type { Editor, Range } from "@tiptap/core";
import {
	Heading2,
	Heading3,
	Heading4,
	Image,
	Link2,
	List,
	ListOrdered,
	ListTodo,
	type LucideIcon,
	Minus,
	Paperclip,
	Pilcrow,
	Quote,
	SquareCode,
	Superscript,
	Table2,
} from "lucide-react";
import type { TranslatorFor } from "../translator";
import {
	type BlockInsertAction,
	blockInsertActions,
	OPEN_FILE_PICKER_EVENT,
	OPEN_IMAGE_DIALOG_EVENT,
} from "./block-inserts";
import { insertFootnote } from "./footnote-nodes";
import { editorMessages } from "./messages";

/** Search term list (dictionary values joined by commas). */
const keywordList = (
	t: TranslatorFor<typeof editorMessages>,
	key: Parameters<TranslatorFor<typeof editorMessages>>[0],
): string[] =>
	t(key)
		.split(",")
		.map((word) => word.trim());

export { OPEN_FILE_PICKER_EVENT, OPEN_IMAGE_DIALOG_EVENT } from "./block-inserts";

export interface SlashCommandItem {
	/** Name of the block insertion item (nodeView for core blocks, block name for added blocks). Absent for basic formatting items. */
	id?: string;
	/** Icon. For block insertion items it is the block definition's `editor.icon` (lucide name). A puzzle icon if absent. */
	icon?: LucideIcon | string;
	title: string;
	description: string;
	keywords: string[];
	action: (editor: Editor, range: Range) => void;
}

const HEADING_ICONS = { 2: Heading2, 3: Heading3, 4: Heading4 } as const;

const heading = (t: TranslatorFor<typeof editorMessages>, level: 2 | 3 | 4): SlashCommandItem => ({
	title: t(`slash.h${level}.title`),
	icon: HEADING_ICONS[level],
	description: t(`slash.h${level}.description`),
	keywords: [
		...keywordList(t, "slash.heading.keywords"),
		`h${level}`,
		`heading${level}`,
		...keywordList(t, `slash.h${level}.keywords`),
	],
	action: (editor, range) => {
		editor.chain().focus().deleteRange(range).toggleHeading({ level }).run();
	},
});

/**
 * Basic formatting and inline slash commands.
 */
export const baseSlashCommands = (t: TranslatorFor<typeof editorMessages>): SlashCommandItem[] => [
	{
		title: t("slash.paragraph.title"),
		description: t("slash.paragraph.description"),
		icon: Pilcrow,
		keywords: keywordList(t, "slash.paragraph.keywords"),
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).setParagraph().run();
		},
	},
	heading(t, 2),
	heading(t, 3),
	heading(t, 4),
	{
		title: t("slash.bullet.title"),
		description: t("slash.bullet.description"),
		icon: List,
		keywords: keywordList(t, "slash.bullet.keywords"),
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleBulletList().run();
		},
	},
	{
		title: t("slash.ordered.title"),
		description: t("slash.ordered.description"),
		icon: ListOrdered,
		keywords: keywordList(t, "slash.ordered.keywords"),
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleOrderedList().run();
		},
	},
	{
		title: t("slash.todo.title"),
		description: t("slash.todo.description"),
		icon: ListTodo,
		keywords: keywordList(t, "slash.todo.keywords"),
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleTaskList().run();
		},
	},
	{
		title: t("slash.quote.title"),
		description: t("slash.quote.description"),
		icon: Quote,
		keywords: keywordList(t, "slash.quote.keywords"),
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleBlockquote().run();
		},
	},
	{
		title: t("slash.code.title"),
		description: t("slash.code.description"),
		icon: SquareCode,
		keywords: keywordList(t, "slash.code.keywords"),
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
		},
	},
	{
		title: t("slash.table.title"),
		description: t("slash.table.description"),
		icon: Table2,
		keywords: keywordList(t, "slash.table.keywords"),
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
		},
	},
	{
		title: t("slash.divider.title"),
		description: t("slash.divider.description"),
		icon: Minus,
		keywords: keywordList(t, "slash.divider.keywords"),
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).setHorizontalRule().run();
		},
	},
	{
		title: t("slash.image.title"),
		description: t("slash.image.description"),
		icon: Image,
		keywords: keywordList(t, "slash.image.keywords"),
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).run();
			window.dispatchEvent(new CustomEvent(OPEN_IMAGE_DIALOG_EVENT));
		},
	},
	{
		title: t("slash.file.title"),
		description: t("slash.file.description"),
		icon: Paperclip,
		keywords: keywordList(t, "slash.file.keywords"),
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).run();
			window.dispatchEvent(new CustomEvent(OPEN_FILE_PICKER_EVENT));
		},
	},
	{
		title: t("slash.internalLink.title"),
		description: t("slash.internalLink.description"),
		icon: Link2,
		keywords: keywordList(t, "slash.internalLink.keywords"),
		action: (editor, range) => {
			editor.chain().focus().deleteRange(range).insertContent("[[").run();
		},
	},
	{
		title: t("slash.footnote.title"),
		description: t("slash.footnote.description"),
		icon: Superscript,
		keywords: keywordList(t, "slash.footnote.keywords"),
		action: (editor, range) => {
			insertFootnote(editor, range);
		},
	},
];

/** Slash menu block order: added blocks (block extensions, site settings) first, then core blocks (math, etc.). */
const menuBlocks = (site: Pick<Site, "ADDED_BLOCKS" | "BLOCKS">): readonly BlockDefinition[] => [
	...site.ADDED_BLOCKS,
	...site.BLOCKS.filter((block) => !site.ADDED_BLOCKS.includes(block)),
];

/**
 * Among block definitions (site.BLOCKS) with `editor.insertable === true` and `editor.view === 'node'`,
 * generates the slash command list for blocks with a registered insert action.
 */
export function buildBlockSlashCommands(
	site: Site,
	definitions: readonly BlockDefinition[] = menuBlocks(site),
	actions: Record<string, BlockInsertAction> = blockInsertActions(site),
): SlashCommandItem[] {
	const t = site.createTranslator(editorMessages);
	const items: SlashCommandItem[] = [];
	for (const block of definitions) {
		if (block.editor.insertable !== true || block.editor.view !== "node") continue;
		// Added blocks have no editor name, so find the insert action by block name.
		const nodeView = block.editor.nodeView ?? block.name;
		// Images have an existing hardcoded item, so exclude duplicates
		if (nodeView === "image" || block.name === "image") continue;
		const action = actions[nodeView];
		if (!action) continue;

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

const slashTablesOf = perSite((site: Site) => {
	const base = baseSlashCommands(site.createTranslator(editorMessages));
	const blocks = buildBlockSlashCommands(site);
	return {
		base,
		blocks,
		/**
		 * `/` block insertion menu. Searchable by Korean and English names.
		 * The post title is the H1 above the body, so body headings start at H2.
		 */
		all: [...base, ...blocks] as SlashCommandItem[],
	};
});

/** The slash menu of a site: the basic formatting items, then its block insertion items (core blocks after added blocks). */
export const slashCommands = (site: Site): SlashCommandItem[] => slashTablesOf(site).all;

/**
 * Slash menu items. `extra` are items added by edit view extensions (plugins) (appended after), and `inline` are items added by text decoration extensions
 * (after the basic text formatting items, before block items).
 */
export function filterCommands(
	site: Site,
	query: string,
	extra: readonly SlashCommandItem[] = [],
	inline: readonly SlashCommandItem[] = [],
): SlashCommandItem[] {
	const { base, blocks, all } = slashTablesOf(site);
	const commands = extra.length > 0 || inline.length > 0 ? [...base, ...inline, ...blocks, ...extra] : all;
	if (!query) return commands;
	const clean = query.trim().toLowerCase();
	return commands.filter((cmd) => {
		if (cmd.title.toLowerCase().includes(clean)) return true;
		if (cmd.description.toLowerCase().includes(clean)) return true;
		return cmd.keywords.some((k) => k.toLowerCase().includes(clean));
	});
}
