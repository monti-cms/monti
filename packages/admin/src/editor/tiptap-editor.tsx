"use client";

import { cmsApiUrl, createTranslator, FILE_ACCEPT, LINKABLE_COLLECTIONS } from "@monti-cms/core/client";
import type { Editor, Range } from "@tiptap/core";
import { CellSelection } from "@tiptap/pm/tables";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import {
	AlignCenter,
	AlignLeft,
	AlignRight,
	ChevronDown,
	Heading2,
	Heading3,
	Heading4,
	ImageIcon,
	Link2,
	List,
	ListOrdered,
	ListTodo,
	type LucideIcon,
	Minus,
	Paperclip,
	Pilcrow,
	Quote,
	RemoveFormatting,
	SquareCode,
	Superscript,
	Table2,
	Upload,
} from "lucide-react";
import {
	type CSSProperties,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useReducer,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";
import { type EditorInsertAction, type EditorSelectionAction, useCmsAdminComponents } from "../admin-components";
import { MEDIA_NOT_CONFIGURED } from "../screens/api-error-message";
import { useAdminFeatures } from "../screens/shared/admin-features";
import { Button } from "../ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
import { IconButton } from "../ui/icon-button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Toggle } from "../ui/toggle";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { deleteBlock, duplicateBlock, moveBlock } from "./block-commands";
import { BlockHandleOverlay } from "./block-handle-overlay";
import { CodeLinkBar } from "./code-block/code-link-bar";
import { CustomBlockMenu, CustomBlockMenuItems } from "./custom-block-menu";
import { endBlockDrag, findBlockDOM, refineBlock, resolveTargetBlock, startBlockDrag, startMarquee } from "./drag";
import { EDITOR_WIDTHS, EditorWidthMenu, useEditorWidth } from "./editor-width";
import { buildEditorExtensions } from "./extensions";
import { FILE_NODE_NAME } from "./file-node";
import { ImageInsertDialog, type ImageInsertion } from "./image-insert-dialog";
import { InlineBubble, useMarkExtensions } from "./inline-bubble";
import { INLINE_MARK_TOOLS } from "./inline-marks";
import { type InternalLinkItem, insertInternalLink, parseInternalLinkTrigger } from "./internal-link";
import { InternalLinkPopup } from "./internal-link-popup";
import { type LinkDraft, LinkForm, linkDraftFromSelection } from "./link-form";
import { editorMessages } from "./messages";
import {
	filterCommands,
	OPEN_FILE_PICKER_EVENT,
	OPEN_IMAGE_DIALOG_EVENT,
	type SlashCommandItem,
} from "./slash-command";
import { SlashMenuPopup } from "./slash-menu-popup";
import { TableToolbar } from "./table-toolbar";
import { mdxToTiptap, tiptapToMdx } from "./tiptap-content";
import { ToolbarButton, type ToolbarItem } from "./toolbar-button";
import { type ToolbarEntry, ToolbarMenuGroup, ToolbarMenuItem, ToolbarMenuSection, ToolbarRow } from "./toolbar-row";
import { uploadAttachment } from "./upload-helper";

const t = createTranslator(editorMessages);

interface CmsEditorProps {
	content: string;
	onChange: (newContent: string) => void;
	/** 편집 문서의 제목 입력. 서식 도구 아래, 본문 위에 놓는다. */
	titleField?: ReactNode;
	/** 서식 도구 맨 끝에 놓을 문서 작업 메뉴. */
	toolbarEnd?: ReactNode;
	/** 서식 도구와 떨어진 툴바 오른쪽 끝(보기 전환 등). */
	toolbarAside?: ReactNode;
	/** 주어지면 본문 자리에 이것(원문 편집 등)을 보이고 시각 편집을 멈춘다. 툴바와 제목은 그대로 둔다. */
	sourceView?: ReactNode;
	onCompositionStart?: () => void;
	onCompositionEnd?: () => void;
	/** 휴지통처럼 편집할 수 없는 상태면 false다. */
	editable?: boolean;
	/** 블록 손잡이 옆에 더 붙일 동작(번역본의 `번역` 등). 그 블록에서 쓸 수 있을 때만 보인다. */
	blockActions?: readonly BlockAction[];
	/** 편집기가 만들어지거나 사라질 때 부른다(바깥에서 문서 전체 작업을 할 때). */
	onEditor?: (editor: Editor | null) => void;
	/** 선택 영역 메뉴에 더할 동작(플러그인). */
	selectionActions?: readonly EditorSelectionAction[];
	/** 슬래시 메뉴에 더할 삽입 동작(플러그인). */
	insertActions?: readonly EditorInsertAction[];
}

/** 블록 손잡이 옆 동작. `pos`는 손잡이가 가리키는 블록의 위치다. */
export interface BlockAction {
	id: string;
	label: string;
	icon: ReactNode;
	isAvailable: (editor: Editor, pos: number) => boolean;
	run: (editor: Editor, pos: number) => void;
	/** 그 블록에서 동작이 진행 중인가. */
	isBusy?: (pos: number) => boolean;
}

type Coords = { top: number; left: number };

const chain = (editor: Editor) => editor.chain().focus();

/** 블록 모양 드롭다운. 지금 블록의 모양 이름이 드롭다운 이름이 된다. */
const BLOCK_STYLES: ToolbarItem[] = [
	{
		label: t("toolbar.paragraph"),
		icon: Pilcrow,
		isActive: (e) => e.isActive("paragraph"),
		run: (e) => chain(e).setParagraph().run(),
	},
	...([2, 3, 4] as const).map((level) => ({
		label: `H${level}`,
		title: t("toolbar.heading", { level }),
		icon: { 2: Heading2, 3: Heading3, 4: Heading4 }[level],
		isActive: (e: Editor) => e.isActive("heading", { level }),
		run: (e: Editor) => chain(e).setHeading({ level }).run(),
	})),
];

/** 자주 쓰지 않아 한 드롭다운으로 묶는 첨자 마크. */
const SCRIPT_MARKS = ["superscript", "subscript"];
const INLINE_TOOLS = INLINE_MARK_TOOLS.filter((tool) => !SCRIPT_MARKS.includes(tool.mark));
const SCRIPT_TOOLS = INLINE_MARK_TOOLS.filter((tool) => SCRIPT_MARKS.includes(tool.mark));
/** 글자 꾸밈 버튼을 숨기는 순서(큰 것부터). 없는 마크는 5. 굵게·기울임은 숨기지 않는다. */
const INLINE_PRIORITY: Readonly<Record<string, number>> = { bold: 0, italic: 0, strike: 6, code: 4, underline: 5 };
const PINNED_INLINE_MARKS = ["bold", "italic"];

const ALIGN_TOOLS: ToolbarItem[] = [
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

/** 목록 드롭다운. 지금 블록의 목록 종류가 드롭다운 이름·아이콘이 된다. */
const LIST_STYLES: ToolbarItem[] = [
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
	{
		label: t("toolbar.todoLabel"),
		title: t("toolbar.todo"),
		icon: ListTodo,
		isActive: (e) => e.isActive("taskList"),
		run: (e) => chain(e).toggleTaskList().run(),
	},
];

/** 블록 넣기 버튼과 숨기는 순서(큰 것부터). 목록은 2, 컴포넌트는 4. */
const INSERT_TOOLS: { tool: ToolbarItem; priority: number }[] = [
	{
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
		priority: 3,
		tool: {
			label: t("toolbar.codeBlock"),
			icon: SquareCode,
			isActive: (e) => e.isActive("codeBlock"),
			run: (e) => chain(e).toggleCodeBlock().run(),
		},
	},
	{
		priority: 7,
		tool: {
			label: t("toolbar.table"),
			icon: Table2,
			run: (e) => chain(e).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
		},
	},
];

const DIVIDER_TOOL: ToolbarItem = {
	label: t("toolbar.divider"),
	icon: Minus,
	run: (e) => chain(e).setHorizontalRule().run(),
};

/** 글자 꾸밈 확장의 서식 도구 자리 이름(`mark:블록 이름`). */
const markToolKey = (group: "format" | "link", name: string) => `mark-${group}:${name}`;

/**
 * 도구 모음 순서. 문단 모양 → 글자 꾸밈(확장의 꾸밈 포함) → 글자에 붙이기(링크·확장의 꾸밈) → 목록·정렬 → 블록 넣기.
 * 문서 단위 도구(템플릿·확장·원문·MDX·폭)는 편집 화면이 오른쪽(`toolbarAside`)에 둔다. 여기 없는 항목은 끝에 원래 순서대로 붙는다.
 * `mark-format:*`·`mark-link:*`는 확장이 더한 순서다.
 */
const TOOLBAR_ORDER = [
	"block-style",
	"divider-block",
	...INLINE_TOOLS.map((tool) => tool.mark),
	"mark-format:*",
	"script",
	"divider-inline",
	"link",
	"mark-link:*",
	"divider-list",
	"list",
	"align",
	"divider-insert",
	...INSERT_TOOLS.map(({ tool }) => tool.label),
	"divider-tool",
	"upload",
	"custom-block",
];

const orderToolbar = (entries: readonly ToolbarEntry[]): ToolbarEntry[] => {
	const rank = (key: string) => {
		const group = /^(mark-(?:format|link)):/.exec(key)?.[1];
		const index = TOOLBAR_ORDER.indexOf(group ? `${group}:*` : key);
		return index < 0 ? TOOLBAR_ORDER.length : index;
	};
	// 같은 자리 안에서는 원래 순서를 지킨다(Array.prototype.sort는 안정 정렬이다).
	return [...entries].sort((a, b) => rank(a.key) - rank(b.key));
};

function ToolbarDropdown({
	editor,
	label,
	items,
	icon: Icon,
	iconOnly = false,
}: {
	editor: Editor;
	label: string;
	items: ToolbarItem[];
	icon?: LucideIcon;
	/** 글자 없이 아이콘만 보인다. 이름은 aria-label과 툴팁으로 알린다. */
	iconOnly?: boolean;
}) {
	const content = (
		<>
			{Icon && <Icon aria-hidden className="size-4" />}
			{!iconOnly && label}
			<ChevronDown aria-hidden className="size-3" />
		</>
	);
	return (
		<DropdownMenu>
			{iconOnly ? (
				<IconButton
					label={label}
					side="bottom"
					size="sm"
					className="h-8 gap-1 px-1.5 text-xs"
					disabled={!editor.isEditable}
					onMouseDown={(event) => event.preventDefault()}
					trigger={(button) => <DropdownMenuTrigger render={button} />}
				>
					{content}
				</IconButton>
			) : (
				<DropdownMenuTrigger
					render={
						<Button
							type="button"
							variant="ghost"
							size="sm"
							className="h-8 gap-1 px-2 text-xs"
							aria-label={label}
							disabled={!editor.isEditable}
							onMouseDown={(event) => event.preventDefault()}
						/>
					}
				>
					{content}
				</DropdownMenuTrigger>
			)}
			<DropdownMenuContent align="start" className="min-w-36">
				{items.map((item) => (
					<ToolbarMenuItem key={item.label} editor={editor} item={item} />
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

async function searchLinkTargets(query: string): Promise<InternalLinkItem[]> {
	const search = async (collection: string) => {
		const params = new URLSearchParams({ collection, pageSize: "25" });
		if (query) params.set("search", query);
		for (const status of ["draft", "published"]) params.append("status", status);
		const res = await fetch(cmsApiUrl(`/v1/entries?${params.toString()}`));
		if (!res.ok) return [];
		const data = (await res.json()) as {
			items: { id: string; collection: string; title: string | null; slug: string | null; status: string }[];
		};
		return data.items.map((item) => ({
			id: item.id,
			collection: item.collection,
			title: item.title || t("toolbar.untitled"),
			slug: item.slug ?? "",
			status: item.status,
		}));
	};
	// 공개 경로가 있는 컬렉션(본문 링크로 가리킬 수 있는 것)만 찾는다.
	const results = await Promise.all(LINKABLE_COLLECTIONS.map(search));
	return results.flat().slice(0, 20);
}

/** 핸들 폭(px)과 블록과의 간격. BlockHandleOverlay가 `left - 32`에 24px 버튼을 둔다. */
const HANDLE_OFFSET = 32;
const HANDLE_WIDTH = 24;

/**
 * 핸들을 붙일 기준점.
 * - 목록 항목은 글머리표를 가리지 않게 목록의 왼쪽(글머리표 바깥)에 붙인다. 들여쓴 항목은 그 들여쓰기에 붙는다.
 * - 테두리가 있는 컨테이너(콜아웃·접기·탭·단 나누기) 안쪽 블록의 핸들이 그 왼쪽 테두리에 걸리면
 *   컨테이너 바깥 핸들 자리로 옮긴다(같은 세로줄에 맞춘다).
 */
const handleAnchor = (block: HTMLElement, rect: DOMRect): Coords => {
	const isListItem = block.tagName === "LI" || block.getAttribute("data-type") === "taskItem";
	const list = isListItem ? block.parentElement : null;
	let left = list ? list.getBoundingClientRect().left : rect.left;
	const framed = block.parentElement?.closest<HTMLElement>("[data-cms-framed]");
	if (framed) {
		const edge = framed.getBoundingClientRect().left;
		const handleLeft = left - HANDLE_OFFSET;
		if (handleLeft <= edge + 1 && handleLeft + HANDLE_WIDTH >= edge - 1) left = edge;
	}
	return { top: rect.top, left };
};

/** 화면에 띄운 핸들과 그 핸들이 옮기는 블록의 위치. */
type HandleSpot = Coords & { pos: number };

const sameSpot = (a: HandleSpot | null, b: HandleSpot) =>
	!!a && a.top === b.top && a.left === b.left && a.pos === b.pos;

export function CmsEditor({
	content,
	onChange,
	titleField,
	toolbarEnd,
	toolbarAside,
	sourceView,
	onCompositionStart,
	onCompositionEnd,
	editable = true,
	blockActions,
	onEditor,
	selectionActions,
	insertActions,
}: CmsEditorProps) {
	const isSourceMode = sourceView != null && sourceView !== false;
	// 글자 꾸밈 확장(블록 확장의 `:tooltip` 등). 모양·서식 도구·슬래시 메뉴를 준다.
	const { marks: markSpecs = {} } = useCmsAdminComponents();
	const allMarkExtensions = useMarkExtensions();
	// 원문을 고치는 동안에는 시각 편집기를 멈춘다. 툴바 도구도 함께 잠긴다.
	const canEdit = editable && !isSourceMode;
	const { media } = useAdminFeatures();
	// 원문 모드로 열린 본문은 해석할 수 없을 수 있다. 시각 편집기는 빈 문서로 만들고 돌아올 때 채운다.
	const [initialContent] = useState(() => mdxToTiptap(isSourceMode ? "" : content));
	const isInternalUpdateRef = useRef(false);
	// 툴바 오른쪽 끝 요소의 폭. 도구 묶음이 가운데에 오도록 양쪽을 이만큼 비운다.
	const asideRef = useRef<HTMLDivElement>(null);
	const [asideWidth, setAsideWidth] = useState(72);
	useEffect(() => {
		const element = asideRef.current;
		if (!element) return;
		const measure = () => setAsideWidth(Math.ceil(element.getBoundingClientRect().width));
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	});
	const isComposingRef = useRef(false);
	const editorRef = useRef<Editor | null>(null);
	const [width, setWidth] = useEditorWidth();

	const [slash, setSlash] = useState<{ query: string; index: number; coords: Coords } | null>(null);
	const slashRangeRef = useRef<Range | null>(null);
	// 확장(플러그인)이 더한 슬래시 메뉴 항목. 키 처리기가 최신 값을 읽도록 ref에도 둔다.
	const extraCommands = useMemo<SlashCommandItem[]>(
		() =>
			(insertActions ?? []).map((item) => ({
				id: item.id,
				title: item.title,
				description: item.description,
				keywords: [...item.keywords],
				...(item.icon ? { icon: item.icon } : {}),
				action: (current, range) => item.run(current, range),
			})),
		[insertActions],
	);
	const extraCommandsRef = useRef(extraCommands);
	extraCommandsRef.current = extraCommands;
	// 글자 꾸밈 확장의 슬래시 메뉴 항목(기본 글 서식 항목 다음).
	const inlineCommands: SlashCommandItem[] = allMarkExtensions.flatMap(({ extension }) =>
		(extension.insertActions ?? []).map((item) => ({
			id: item.id,
			title: item.title,
			description: item.description,
			keywords: [...item.keywords],
			...(item.icon ? { icon: item.icon } : {}),
			action: (current: Editor, range: Range) => item.run(current, range),
		})),
	);
	const inlineCommandsRef = useRef(inlineCommands);
	inlineCommandsRef.current = inlineCommands;
	const slashRef = useRef(slash);
	slashRef.current = slash;

	const [link, setLink] = useState<{ query: string; index: number; coords: Coords } | null>(null);
	const [linkItems, setLinkItems] = useState<InternalLinkItem[]>([]);
	const [isLinkLoading, setIsLinkLoading] = useState(false);
	const linkRangeRef = useRef<Range | null>(null);
	const linkRef = useRef(link);
	linkRef.current = link;
	const linkItemsRef = useRef(linkItems);
	linkItemsRef.current = linkItems;

	const [handleSpot, setHandleSpot] = useState<HandleSpot | null>(null);
	const activeBlockRectRef = useRef<DOMRect | null>(null);
	const activeBlockPosRef = useRef<number | null>(null);
	const activeBlockElRef = useRef<HTMLElement | null>(null);
	const [imageDialog, setImageDialog] = useState<{ file: File | null } | null>(null);
	const [linkDraft, setLinkDraft] = useState<LinkDraft | null>(null);

	const syncTriggerPopup = (current: Editor) => {
		if (isComposingRef.current) return;
		const { from } = current.state.selection;
		const textBefore = current.state.doc.textBetween(Math.max(0, from - 50), from, "\n", "\0");

		const linkMatch = parseInternalLinkTrigger(textBefore);
		if (linkMatch.active) {
			linkRangeRef.current = { from: from - linkMatch.query.length - 2, to: from };
			setLink({ query: linkMatch.query, index: 0, coords: current.view.coordsAtPos(from) });
			setSlash(null);
			return;
		}
		setLink(null);

		// `/` 메뉴는 빈 문단의 시작에서만 연다(§4.2). 문장 안의 경로(`a/b`)를 명령으로 오인하지 않는다.
		const slashMatch = textBefore.match(/(?:^|\n)\/([^\s/]*)$/);
		if (!slashMatch || current.isActive("codeBlock")) {
			setSlash(null);
			return;
		}
		const query = slashMatch[1] ?? "";
		slashRangeRef.current = { from: from - query.length - 1, to: from };
		setSlash({ query, index: 0, coords: current.view.coordsAtPos(from) });
	};

	const chooseLink = (item: InternalLinkItem) => {
		const current = editorRef.current;
		if (!current || !linkRangeRef.current) return;
		insertInternalLink(current, linkRangeRef.current, item);
		setLink(null);
	};

	const editor = useEditor({
		immediatelyRender: false,
		editable: canEdit,
		extensions: buildEditorExtensions(markSpecs),
		content: initialContent,
		editorProps: {
			attributes: {
				"aria-label": t("toolbar.editorLabel"),
				class:
					"prose cms-dark:prose-invert max-w-none min-h-full flex-1 p-6 focus:outline-none text-cms-foreground text-base leading-relaxed selection:bg-cms-primary/20 " +
					// 표 열 너비 조절 손잡이(prosemirror-tables columnResizing)
					"[&_.tableWrapper]:overflow-x-auto [&_td]:relative [&_th]:relative [&.resize-cursor]:cursor-col-resize [&_.column-resize-handle]:pointer-events-none [&_.column-resize-handle]:absolute [&_.column-resize-handle]:-right-px [&_.column-resize-handle]:top-0 [&_.column-resize-handle]:-bottom-px [&_.column-resize-handle]:w-0.5 [&_.column-resize-handle]:bg-cms-primary " +
					// 단 나누기 경계와 같은 모양: 얇은 선 + 첫 행 위쪽의 작은 손잡이.
					"[&_tr:first-child_.column-resize-handle]:after:absolute [&_tr:first-child_.column-resize-handle]:after:top-0.5 [&_tr:first-child_.column-resize-handle]:after:left-1/2 [&_tr:first-child_.column-resize-handle]:after:h-3 [&_tr:first-child_.column-resize-handle]:after:w-6 [&_tr:first-child_.column-resize-handle]:after:-translate-x-1/2 [&_tr:first-child_.column-resize-handle]:after:rounded-full [&_tr:first-child_.column-resize-handle]:after:border [&_tr:first-child_.column-resize-handle]:after:bg-cms-popover [&_tr:first-child_.column-resize-handle]:after:shadow-sm " +
					// 블록 선택(마키): 줄 뒤에 여백(-inset-1)을 둔 상자를 깔고 글자 선택 표시는 숨긴다. 목록 항목은 글머리표까지 덮는다.
					// 글자 선택(primary 보라)과 헷갈리지 않게 다른 색(하늘)과 테두리로 "블록을 골랐다"는 것을 보여 준다.
					"[&_.cms-block-selected]:relative [&_.cms-block-selected]:isolate [&_.cms-block-selected]:before:pointer-events-none [&_.cms-block-selected]:before:absolute [&_.cms-block-selected]:before:-inset-1 [&_.cms-block-selected]:before:-z-10 [&_.cms-block-selected]:before:rounded-md [&_.cms-block-selected]:before:bg-sky-500/10 [&_.cms-block-selected]:before:ring-1 [&_.cms-block-selected]:before:ring-sky-500/35 cms-dark:[&_.cms-block-selected]:before:bg-sky-400/15 cms-dark:[&_.cms-block-selected]:before:ring-sky-400/40 [&_li.cms-block-selected]:before:-left-7 [&.cms-block-range]:selection:bg-transparent " +
					// 셀을 끌어 여러 칸을 고르면(CellSelection) 고른 칸을 칠한다. 병합할 범위를 눈으로 확인한다.
					"[&_.selectedCell]:bg-cms-primary/15 [&_.selectedCell]:outline-1 [&_.selectedCell]:-outline-offset-1 [&_.selectedCell]:outline-cms-primary/60",
			},
			handleKeyDown: (view, event) => {
				// 한글 IME 조합 중에는 메뉴 탐색·확정을 처리하지 않는다(§4.2).
				if (view.composing || event.isComposing || event.keyCode === 229) return false;

				const openLink = linkRef.current;
				if (openLink) {
					const items = linkItemsRef.current;
					if (event.key === "ArrowDown" || event.key === "ArrowUp") {
						event.preventDefault();
						const step = event.key === "ArrowDown" ? 1 : -1;
						setLink({ ...openLink, index: items.length ? (openLink.index + step + items.length) % items.length : 0 });
						return true;
					}
					if (event.key === "Enter") {
						const selected = items[openLink.index];
						if (!selected) {
							setLink(null);
							return false;
						}
						event.preventDefault();
						chooseLink(selected);
						return true;
					}
					if (event.key === "Escape") {
						event.preventDefault();
						setLink(null);
						return true;
					}
				}

				const openSlash = slashRef.current;
				if (openSlash) {
					const filtered = filterCommands(openSlash.query, extraCommandsRef.current, inlineCommandsRef.current);
					if (event.key === "ArrowDown" || event.key === "ArrowUp") {
						event.preventDefault();
						const step = event.key === "ArrowDown" ? 1 : -1;
						const size = Math.max(1, filtered.length);
						setSlash({ ...openSlash, index: (openSlash.index + step + size) % size });
						return true;
					}
					if (event.key === "Enter") {
						const command = filtered[openSlash.index];
						if (!command || !slashRangeRef.current || !editorRef.current) {
							setSlash(null);
							return false;
						}
						event.preventDefault();
						command.action(editorRef.current, slashRangeRef.current);
						setSlash(null);
						return true;
					}
					if (event.key === "Escape") {
						event.preventDefault();
						setSlash(null);
						return true;
					}
				}
				return false;
			},
		},
		onUpdate: ({ editor: current }) => {
			if (isInternalUpdateRef.current) return;
			onChange(tiptapToMdx(current.getJSON()));
			syncTriggerPopup(current);
		},
		onSelectionUpdate: ({ editor: current }) => syncTriggerPopup(current),
	});

	// 이 편집기 스키마에 있는 글자 꾸밈 확장(사이트가 쓰는 블록)만 도구를 그린다.
	const markExtensions = allMarkExtensions.filter(({ name }) => !editor || editor.schema.marks[name]);
	const markNames = markExtensions.map(({ name }) => name);

	// 선택 위치와 적용된 서식이 바뀌면 드롭다운 이름·활성 표시를 갱신한다(표 조작 도구는 TableToolbar가 따로 구독한다).
	useEditorState({
		editor,
		selector: ({ editor: current }) => {
			if (!current) return "";
			const selection = current.state.selection;
			const active = [...BLOCK_STYLES, ...INLINE_TOOLS, ...SCRIPT_TOOLS, ...ALIGN_TOOLS, ...LIST_STYLES]
				.map((item) => (item.isActive?.(current) ? "1" : "0"))
				.join("");
			const marks = ["link", ...markNames].map((mark) => (current.isActive(mark) ? "1" : "0")).join("");
			return `${active}${marks}:${current.isActive("table") ? "table" : ""}:${selection.from}:${selection.to}:${selection instanceof CellSelection}`;
		},
	});

	const blockStyle = editor
		? (BLOCK_STYLES.find((item) => item.isActive?.(editor))?.label ?? t("toolbar.paragraph"))
		: t("toolbar.paragraph");
	const activeList = editor ? LIST_STYLES.find((item) => item.isActive?.(editor)) : undefined;
	const activeAlign = editor ? ALIGN_TOOLS.find((item) => item.isActive?.(editor)) : undefined;

	useEffect(() => {
		editorRef.current = editor;
		if (!editor || isSourceMode) return;
		// 노드 뷰를 React로 다시 그리므로 effect 안에서 바로 바꾸지 않는다(flushSync 경고). 원문 모드에서 돌아올 때 등.
		let cancelled = false;
		queueMicrotask(() => {
			if (cancelled || editor.isDestroyed) return;
			// 비교 기준은 저장 문자열(MDX)이다 — Tiptap JSON 객체 비교는 순서 때문에 깨진다.
			if (tiptapToMdx(editor.getJSON()) === content) return;
			isInternalUpdateRef.current = true;
			editor.commands.setContent(mdxToTiptap(content), { emitUpdate: false });
			isInternalUpdateRef.current = false;
		});
		return () => {
			cancelled = true;
		};
	}, [content, editor, isSourceMode]);

	// 툴바 도구는 그릴 때 editor.isEditable을 읽는다. 잠금을 바꾼 뒤 한 번 더 그려 도구 상태를 맞춘다.
	const [, rerender] = useReducer((count: number) => count + 1, 0);
	useEffect(() => {
		if (!editor || editor.isEditable === canEdit) return;
		// update 이벤트를 내지 않는다. 내면 원문 모드로 바뀔 때 멈춘 시각 문서가 본문을 덮어쓴다.
		editor.setEditable(canEdit, false);
		// 노드 뷰(코드 블록 머리 도구·블록 도구 줄)가 잠금을 따라 다시 그리도록 문서를 바꾸지 않는 트랜잭션을 낸다.
		// effect 안에서 바로 내면 노드 뷰를 그리는 중 flushSync 경고가 나므로 미룬다.
		queueMicrotask(() => {
			if (!editor.isDestroyed)
				editor.view.dispatch(editor.state.tr.setMeta("cmsEditable", canEdit).setMeta("addToHistory", false));
		});
		rerender();
	}, [canEdit, editor]);

	const linkQuery = link?.query;
	useEffect(() => {
		if (linkQuery === undefined) return;
		let cancelled = false;
		setIsLinkLoading(true);
		const timer = setTimeout(() => {
			searchLinkTargets(linkQuery)
				.then((items) => {
					if (!cancelled) setLinkItems(items);
				})
				.catch(() => {
					if (!cancelled) setLinkItems([]);
				})
				.finally(() => {
					if (!cancelled) setIsLinkLoading(false);
				});
		}, 200);
		return () => {
			cancelled = true;
			clearTimeout(timer);
		};
	}, [linkQuery]);

	useEffect(() => {
		const open = () => setImageDialog({ file: null });
		window.addEventListener(OPEN_IMAGE_DIALOG_EVENT, open);
		return () => window.removeEventListener(OPEN_IMAGE_DIALOG_EVENT, open);
	}, []);

	const insertImage = useCallback(
		(image: ImageInsertion) => {
			editor
				?.chain()
				.focus()
				.insertContent({
					type: "image",
					// 등록 미디어는 `mediaId`만 저장한다. 공개 주소는 렌더러가 해석한다(§4.4, §7.1).
					attrs: {
						mediaId: image.mediaId,
						alt: image.alt,
						decorative: image.decorative || null,
						caption: image.caption,
						width: "100%",
						align: "center",
					},
				})
				.run();
			setImageDialog(null);
		},
		[editor],
	);

	const imageFileFrom = (source: DataTransferItemList | FileList | null): File | null => {
		if (!source) return null;
		for (let i = 0; i < source.length; i++) {
			const entry = source[i];
			const file = entry instanceof File ? entry : entry?.kind === "file" ? entry.getAsFile() : null;
			if (file?.type.startsWith("image/")) return file;
		}
		return null;
	};

	const fileInputRef = useRef<HTMLInputElement>(null);

	// 슬래시 메뉴 "파일": 파일 고르기 창을 연다. 미디어 저장소가 없으면 올릴 수 없다고 알린다.
	useEffect(() => {
		const open = () => {
			if (!media) toast.error(MEDIA_NOT_CONFIGURED);
			else fileInputRef.current?.click();
		};
		window.addEventListener(OPEN_FILE_PICKER_EVENT, open);
		return () => window.removeEventListener(OPEN_FILE_PICKER_EVENT, open);
	}, [media]);

	/** 이미지가 아닌 파일들을 올려 파일 카드로 넣는다. `at`이 있으면 그 자리(끌어 놓은 곳)에 넣는다. */
	const uploadAttachments = useCallback(
		async (files: File[], at?: number) => {
			if (!editor) return;
			if (!media) {
				toast.error(MEDIA_NOT_CONFIGURED);
				return;
			}
			let position = at;
			for (const file of files) {
				const toastId = toast.loading(t("toolbar.uploading", { name: file.name }));
				try {
					const { mediaId } = await uploadAttachment(file, (percent) =>
						toast.loading(t("toolbar.uploadingPercent", { name: file.name, percent }), { id: toastId }),
					);
					const node = { type: FILE_NODE_NAME, attrs: { mediaId, label: null } };
					if (position === undefined) editor.chain().focus().insertContent(node).run();
					else {
						editor.chain().focus().insertContentAt(position, node).run();
						position = editor.state.selection.to;
					}
					toast.success(t("toolbar.uploaded", { name: file.name }), { id: toastId });
				} catch (error) {
					toast.error(t("toolbar.uploadFailed", { name: file.name }), {
						id: toastId,
						description: error instanceof Error ? error.message : undefined,
					});
				}
			}
		},
		[editor, media],
	);

	const attachmentsFrom = (list: FileList | null): File[] =>
		Array.from(list ?? []).filter((file) => !file.type.startsWith("image/"));

	const handleMouseMove = useCallback(
		(event: React.MouseEvent<HTMLDivElement>) => {
			if (!editor) return;
			const root = editor.view.dom;
			// 블록에서 왼쪽 핸들로 가는 길(블록 왼쪽 여백, 목록 들여쓰기)에서는 대상을 바꾸지 않는다.
			// 그러지 않으면 목록 항목에서 핸들로 가는 동안 대상이 목록 전체로 바뀐다.
			const active = activeBlockRectRef.current;
			if (active && event.clientX < active.left && event.clientY >= active.top && event.clientY <= active.bottom)
				return;
			const found = findBlockDOM(root, event.target as HTMLElement | null);
			if (!found) return;
			const block = refineBlock(found, event.clientX, event.clientY);
			try {
				const resolved = resolveTargetBlock(editor.view, block);
				if (!resolved) return;
				activeBlockPosRef.current = resolved.pos;
				activeBlockRectRef.current = resolved.rect;
				activeBlockElRef.current = block;
				const spot = { ...handleAnchor(block, resolved.rect), pos: resolved.pos };
				// 같은 자리면 상태를 바꾸지 않는다. 마우스를 움직일 때마다 편집기를 다시 그리면(useEditor가
				// 옵션을 다시 설정한다) 노드 뷰가 갱신되어 표 열 너비 끌기 등이 흔들린다.
				setHandleSpot((previous) => (sameSpot(previous, spot) ? previous : spot));
			} catch {
				// DOM이 막 바뀌는 중이면 무시한다.
			}
		},
		[editor],
	);

	// 핸들은 화면 고정 위치에 뜬다. 스크롤하면 블록을 따라가고, 블록이 사라졌으면 숨긴다.
	// 그대로 두면 스크롤 뒤 엉뚱한 블록 옆에 옛 핸들이 남아 같은 항목에 핸들이 두 곳처럼 보인다.
	const hasHandle = handleSpot !== null;
	useEffect(() => {
		if (!hasHandle || !editor) return;
		const follow = () => {
			const element = activeBlockElRef.current;
			const pos = activeBlockPosRef.current;
			if (!element?.isConnected || pos === null) {
				setHandleSpot(null);
				return;
			}
			const rect = element.getBoundingClientRect();
			activeBlockRectRef.current = rect;
			const spot = { ...handleAnchor(element, rect), pos };
			setHandleSpot((previous) => (sameSpot(previous, spot) ? previous : spot));
		};
		window.addEventListener("scroll", follow, true);
		window.addEventListener("resize", follow);
		return () => {
			window.removeEventListener("scroll", follow, true);
			window.removeEventListener("resize", follow);
		};
	}, [hasHandle, editor]);

	const handleDragStart = useCallback(
		(pos: number, event: React.DragEvent<HTMLElement>) => {
			if (!editor) return;
			startBlockDrag(editor.view, pos, event);
		},
		[editor],
	);

	const handleDragEnd = useCallback(() => {
		if (!editor) return;
		endBlockDrag(editor.view);
	}, [editor]);

	const onEditorRef = useRef(onEditor);
	onEditorRef.current = onEditor;
	useEffect(() => {
		onEditorRef.current?.(editor);
		return () => onEditorRef.current?.(null);
	}, [editor]);

	const withBlock = (pos: number, action: (current: Editor, pos: number) => boolean) => () => {
		if (!editor) return;
		editor.commands.focus();
		action(editor, pos);
	};

	if (!editor) return null;

	const buttonSlot = (item: ToolbarItem, key: string, priority: number, fixed = false): ToolbarEntry => ({
		key,
		priority,
		fixed,
		render: () => <ToolbarButton editor={editor} item={item} />,
		menu: () => <ToolbarMenuItem editor={editor} item={item} />,
	});
	const dropdownSlot = (
		key: string,
		priority: number,
		label: string,
		items: ToolbarItem[],
		icon: LucideIcon,
		menuLabel = label,
	): ToolbarEntry => ({
		key,
		priority,
		render: () => <ToolbarDropdown editor={editor} label={label} items={items} icon={icon} iconOnly />,
		menu: () => <ToolbarMenuGroup editor={editor} label={menuLabel} items={items} />,
	});
	const UploadMenuItems = () => (
		<>
			<DropdownMenuItem disabled={!canEdit} onClick={() => setImageDialog({ file: null })}>
				<ImageIcon aria-hidden className="size-4" />
				<span className="flex-1">{t("toolbar.image")}</span>
			</DropdownMenuItem>
			<DropdownMenuItem disabled={!canEdit} onClick={() => fileInputRef.current?.click()}>
				<Paperclip aria-hidden className="size-4" />
				<span className="flex-1">{t("toolbar.file")}</span>
			</DropdownMenuItem>
		</>
	);
	// 좁을 때 숨기는 순서: priority가 큰 것부터. fixed는 숨기지 않는다(팝오버 도구는 메뉴 안에서 앵커를 잃는다).
	// 놓는 순서는 아래 `TOOLBAR_ORDER`가 정한다.
	const unordered: ToolbarEntry[] = [
		{
			key: "block-style",
			priority: 0,
			fixed: true,
			render: () => <ToolbarDropdown editor={editor} label={blockStyle} items={BLOCK_STYLES} />,
		},
		dropdownSlot("align", 9, t("toolbar.align"), ALIGN_TOOLS, activeAlign?.icon ?? AlignLeft),
		{ key: "divider-block", divider: true },
		...INLINE_TOOLS.map((tool) =>
			buttonSlot(tool, tool.mark, INLINE_PRIORITY[tool.mark] ?? 5, PINNED_INLINE_MARKS.includes(tool.mark)),
		),
		// 글자 꾸밈 확장의 서식 도구(블록 확장의 글자색·툴팁 등).
		...markExtensions.flatMap(({ name, extension }): ToolbarEntry[] => {
			const tool = extension.toolbar;
			if (!tool) return [];
			const { Button, MenuItems } = tool;
			return [
				{
					key: markToolKey(tool.group, name),
					priority: tool.priority ?? 0,
					fixed: tool.priority === undefined || !MenuItems,
					render: () => <Button editor={editor} />,
					...(MenuItems ? { menu: () => <MenuItems editor={editor} /> } : {}),
				},
			];
		}),
		dropdownSlot("script", 8, t("toolbar.script"), SCRIPT_TOOLS, Superscript),
		{ key: "divider-inline", divider: true },
		{ key: "divider-list", divider: true },
		{ key: "divider-insert", divider: true },
		dropdownSlot(
			"list",
			2,
			activeList?.title ?? t("toolbar.list"),
			LIST_STYLES,
			activeList?.icon ?? List,
			t("toolbar.list"),
		),
		...INSERT_TOOLS.map(({ tool, priority }) => buttonSlot(tool, tool.label, priority)),
		{
			key: "custom-block",
			priority: 4,
			render: () => <CustomBlockMenu editor={editor} />,
			menu: () => (
				<ToolbarMenuSection label={t("toolbar.components")}>
					<CustomBlockMenuItems editor={editor} />
				</ToolbarMenuSection>
			),
		},
		{
			key: "upload",
			// 밑줄(5)보다 늦게 숨긴다. 같은 우선순위면 오른쪽 도구가 먼저 숨는다.
			priority: 4,
			render: () => (
				<DropdownMenu>
					<IconButton
						label={t("toolbar.upload")}
						side="bottom"
						disabled={!canEdit}
						onMouseDown={(event) => event.preventDefault()}
						trigger={(button) => <DropdownMenuTrigger render={button} />}
					>
						<Upload className="size-4" aria-hidden />
					</IconButton>
					<DropdownMenuContent align="start" className="w-40">
						<UploadMenuItems />
					</DropdownMenuContent>
				</DropdownMenu>
			),
			menu: () => <UploadMenuItems />,
		},
		{
			key: "link",
			priority: 0,
			fixed: true,
			render: () => (
				<Popover
					open={linkDraft !== null}
					onOpenChange={(open) => setLinkDraft(open ? linkDraftFromSelection(editor) : null)}
				>
					<Tooltip>
						<TooltipTrigger
							render={
								<PopoverTrigger
									render={
										<Toggle
											size="sm"
											pressed={editor.isActive("link")}
											disabled={!canEdit}
											aria-label={t("toolbar.link")}
											onMouseDown={(event) => event.preventDefault()}
											className="size-8 p-0"
										/>
									}
								>
									<Link2 aria-hidden className="size-4" />
								</PopoverTrigger>
							}
						/>
						<TooltipContent side="bottom">{t("toolbar.link")}</TooltipContent>
					</Tooltip>
					<PopoverContent align="start" className="w-80">
						{linkDraft && <LinkForm editor={editor} draft={linkDraft} onDone={() => setLinkDraft(null)} />}
					</PopoverContent>
				</Popover>
			),
		},
		buttonSlot(DIVIDER_TOOL, "divider-tool", 8),
	];
	const toolbarEntries = orderToolbar(unordered);

	return (
		// biome-ignore lint/a11y/noStaticElementInteractions: editor shell tracks IME and block hover state
		<div
			className="relative flex min-h-full w-full flex-1 flex-col bg-cms-background"
			data-cms-editor-shell
			// 제목·본문·원문이 같은 폭(`--editor-width`)을 쓴다.
			style={{ "--editor-width": EDITOR_WIDTHS[width] } as CSSProperties}
			onCompositionStart={(event) => {
				// 팝오버(포털) 안 입력칸의 조합은 React 트리를 타고 여기까지 오지만 본문 입력이 아니다.
				// 그 입력칸이 조합 중에 사라지면 끝 신호가 오지 않아 저장이 막혔다.
				if (!event.currentTarget.contains(event.target as Node)) return;
				isComposingRef.current = true;
				onCompositionStart?.();
			}}
			onCompositionEnd={() => {
				isComposingRef.current = false;
				syncTriggerPopup(editor);
				onCompositionEnd?.();
			}}
			onMouseMove={handleMouseMove}
			onMouseDown={(event) => {
				// 본문 바깥 빈 여백에서 누른 채 끌면 마키(네모 영역)로 블록을 고른다. 편집기 안쪽 여백은
				// 블록 선택 플러그인이 맡는다. 서식 도구·제목 입력·버튼 같은 조작 요소와 포털(팝오버)은 제외한다.
				const target = event.target as HTMLElement;
				if (!canEdit || !event.currentTarget.contains(target) || editor.view.dom.contains(target)) return;
				if (target.closest('input, textarea, button, select, a, [role="toolbar"], [contenteditable="true"]')) return;
				startMarquee(editor.view, event.nativeEvent);
			}}
		>
			<div
				role="toolbar"
				aria-label={t("toolbar.format")}
				className="sticky top-0 z-10 w-full shrink-0 overflow-x-auto border-b bg-cms-background/95 backdrop-blur"
			>
				{/* 도구 묶음은 툴바 정중앙에 둔다. 오른쪽 끝 요소 폭만큼 양쪽을 똑같이 비우고,
				    그래도 좁으면(번역 원문 칸을 연 때 등) 한 줄을 유지한 채 덜 쓰는 도구를 "더보기"로 접는다. */}
				<div className="relative flex min-h-12 items-center py-2" style={{ paddingInline: asideWidth + 24 }}>
					<ToolbarRow editor={editor} entries={toolbarEntries} end={toolbarEnd} />
					<div ref={asideRef} className="absolute inset-y-0 right-4 flex items-center gap-1">
						{toolbarAside}
						<EditorWidthMenu value={width} onChange={setWidth} />
					</div>
				</div>
				{!isSourceMode && <CodeLinkBar editor={editor} />}
			</div>

			{titleField && (
				<div className="mx-auto w-full max-w-(--editor-width) border-cms-border/60 border-b px-4 pt-12 pb-5">
					{titleField}
				</div>
			)}

			<input
				ref={fileInputRef}
				type="file"
				multiple
				accept={FILE_ACCEPT}
				hidden
				aria-hidden
				tabIndex={-1}
				onChange={(event) => {
					const files = Array.from(event.target.files ?? []);
					event.target.value = "";
					void uploadAttachments(files);
				}}
			/>

			<ImageInsertDialog
				open={imageDialog !== null}
				initialFile={imageDialog?.file ?? null}
				onClose={() => setImageDialog(null)}
				onInsert={insertImage}
			/>

			{isSourceMode && (
				<div className="mx-auto flex w-full max-w-(--editor-width) flex-1 flex-col px-4 pt-6 pb-[35vh]">
					{sourceView}
				</div>
			)}

			{/* 원문 모드에서도 시각 편집기를 내리지 않고 숨긴다. 돌아오면 원문을 다시 읽어 채운다. */}
			{/* biome-ignore lint/a11y: canvas click focuses the rich text editor */}
			<div
				hidden={isSourceMode}
				// 마지막 줄이 화면 아래에 붙지 않게 아래 여백(화면 높이의 35%)을 둔다.
				className="mx-auto flex min-h-full w-full max-w-(--editor-width) flex-1 cursor-text flex-col px-4 pt-6 pb-[35vh]"
				onClick={(event) => {
					// 본문 밖 빈 캔버스를 눌렀을 때만 끝으로 옮긴다. NodeView 버튼·팝오버(포털)의 클릭도
					// React 트리를 따라 여기로 올라오므로, 본문 DOM 안이나 캔버스 밖(포털)은 건드리지 않는다.
					const target = event.target as Node;
					if (!event.currentTarget.contains(target) || editor.view.dom.contains(target)) return;
					if (!editor.isFocused) editor.chain().focus("end").run();
				}}
				onPaste={(event) => {
					const file = imageFileFrom(event.clipboardData.items);
					if (file && canEdit) {
						event.preventDefault();
						setImageDialog({ file });
					}
				}}
				onDrop={(event) => {
					if (!canEdit) return;
					const file = imageFileFrom(event.dataTransfer.files);
					if (file) {
						event.preventDefault();
						setImageDialog({ file });
						return;
					}
					// 이미지가 아닌 파일은 놓은 자리에 파일 카드로 넣는다.
					const attachments = attachmentsFrom(event.dataTransfer.files);
					if (attachments.length > 0) {
						event.preventDefault();
						const at = editor.view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos;
						void uploadAttachments(attachments, at);
					}
				}}
				onDragOver={(event) => event.preventDefault()}
			>
				<EditorContent
					editor={editor}
					className="flex min-h-full flex-1 flex-col [&>.ProseMirror]:min-h-[calc(100vh-240px)] [&>.ProseMirror]:flex-1"
				/>
			</div>

			{slash && !isSourceMode && (
				<SlashMenuPopup
					items={filterCommands(slash.query, extraCommands, inlineCommands)}
					coords={slash.coords}
					selectedIndex={slash.index}
					onSelect={(command) => {
						if (slashRangeRef.current) command.action(editor, slashRangeRef.current);
						setSlash(null);
					}}
					onClose={() => {
						setSlash(null);
						editor.chain().focus().run();
					}}
				/>
			)}

			{link && !isSourceMode && (
				<InternalLinkPopup
					items={linkItems}
					isLoading={isLinkLoading}
					coords={link.coords}
					selectedIndex={link.index}
					onSelect={chooseLink}
					onClose={() => {
						setLink(null);
						editor.chain().focus().run();
					}}
				/>
			)}

			{!isSourceMode && (
				<>
					<TableToolbar editor={editor} />
					<InlineBubble editor={editor} actions={selectionActions} />
				</>
			)}

			{handleSpot && canEdit && (
				<BlockHandleOverlay
					coords={handleSpot}
					onMoveUp={withBlock(handleSpot.pos, (current, pos) => moveBlock(current, pos, -1))}
					onMoveDown={withBlock(handleSpot.pos, (current, pos) => moveBlock(current, pos, 1))}
					onDuplicate={withBlock(handleSpot.pos, duplicateBlock)}
					onDelete={() => {
						withBlock(handleSpot.pos, deleteBlock)();
						setHandleSpot(null);
					}}
					onDragStart={(event) => handleDragStart(handleSpot.pos, event)}
					onDragEnd={handleDragEnd}
					actions={(blockActions ?? [])
						.filter((action) => action.isAvailable(editor, handleSpot.pos))
						.map((action) => ({
							id: action.id,
							label: action.label,
							icon: action.icon,
							busy: action.isBusy?.(handleSpot.pos) ?? false,
							onClick: () => action.run(editor, handleSpot.pos),
						}))}
				/>
			)}
		</div>
	);
}
