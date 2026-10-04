import type { BlockDefinition } from "@monti-cms/core/client";
import { ADDED_BLOCKS, BLOCKS, createTranslator } from "@monti-cms/core/client";
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
	Table2,
} from "lucide-react";
import {
	BLOCK_INSERT_ACTIONS,
	type BlockInsertAction,
	OPEN_FILE_PICKER_EVENT,
	OPEN_IMAGE_DIALOG_EVENT,
} from "./block-inserts";
import { editorMessages } from "./messages";

const t = createTranslator(editorMessages);
/** 검색어 목록(쉼표로 이은 사전 값). */
const keywordList = (key: Parameters<typeof t>[0]): string[] =>
	t(key)
		.split(",")
		.map((word) => word.trim());

export { OPEN_FILE_PICKER_EVENT, OPEN_IMAGE_DIALOG_EVENT } from "./block-inserts";

export interface SlashCommandItem {
	/** 블록 삽입 항목의 이름(본체 블록은 nodeView, 더한 블록은 블록 이름). 기본 서식 항목에는 없다. */
	id?: string;
	/** 아이콘. 블록 삽입 항목은 블록 정의의 `editor.icon`(lucide 이름)이다. 없으면 퍼즐 아이콘이다. */
	icon?: LucideIcon | string;
	title: string;
	description: string;
	keywords: string[];
	action: (editor: Editor, range: Range) => void;
}

const HEADING_ICONS = { 2: Heading2, 3: Heading3, 4: Heading4 } as const;

const heading = (level: 2 | 3 | 4): SlashCommandItem => ({
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
 * 기본 서식 및 인라인 슬래시 커맨드.
 */
export const BASE_SLASH_COMMANDS: SlashCommandItem[] = [
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

/** 슬래시 메뉴 블록 순서: 더한 블록(블록 확장·사이트 설정) 다음에 본체 블록(수식 등)이다. */
const MENU_BLOCKS: readonly BlockDefinition[] = [
	...ADDED_BLOCKS,
	...BLOCKS.filter((block) => !ADDED_BLOCKS.includes(block)),
];

/**
 * 블록 정의(BLOCKS) 중 `editor.insertable === true`이고 `editor.view === 'node'`인 것 중
 * 삽입 액션이 등록된 블록에 대한 슬래시 커맨드 목록을 생성한다(v2 C3a).
 */
export function buildBlockSlashCommands(
	definitions: readonly BlockDefinition[] = MENU_BLOCKS,
	actions: Record<string, BlockInsertAction> = BLOCK_INSERT_ACTIONS,
): SlashCommandItem[] {
	const items: SlashCommandItem[] = [];
	for (const block of definitions) {
		if (block.editor.insertable !== true || block.editor.view !== "node") continue;
		// 더한 블록은 편집기 이름이 없어 블록 이름으로 삽입 동작을 찾는다.
		const nodeView = block.editor.nodeView ?? block.name;
		// 이미지는 기존 하드코딩 항목이 있으므로 중복 제외
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

/** 블록 삽입 항목(더한 블록 다음 본체 블록). */
const BLOCK_SLASH_COMMANDS = buildBlockSlashCommands();

/**
 * `/` 블록 삽입 메뉴(§4.2). 한국어·영문 이름으로 검색한다.
 * 글 제목이 본문 위의 H1이므로 본문 제목은 H2부터 쓴다(§4.1).
 */
export const SLASH_COMMANDS: SlashCommandItem[] = [...BASE_SLASH_COMMANDS, ...BLOCK_SLASH_COMMANDS];

/**
 * 슬래시 메뉴 항목. `extra`는 편집 화면 확장(플러그인)이 더한 항목이고(뒤에 붙는다), `inline`은 글자 꾸밈 확장이 더한 항목이다
 * (기본 글 서식 항목 다음, 블록 항목 앞).
 */
export function filterCommands(
	query: string,
	extra: readonly SlashCommandItem[] = [],
	inline: readonly SlashCommandItem[] = [],
): SlashCommandItem[] {
	const commands =
		extra.length > 0 || inline.length > 0
			? [...BASE_SLASH_COMMANDS, ...inline, ...BLOCK_SLASH_COMMANDS, ...extra]
			: SLASH_COMMANDS;
	if (!query) return commands;
	const clean = query.trim().toLowerCase();
	return commands.filter((cmd) => {
		if (cmd.title.toLowerCase().includes(clean)) return true;
		if (cmd.description.toLowerCase().includes(clean)) return true;
		return cmd.keywords.some((k) => k.toLowerCase().includes(clean));
	});
}
