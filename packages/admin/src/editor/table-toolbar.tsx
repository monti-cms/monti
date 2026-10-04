"use client";

import { createTranslator } from "@monti-cms/core/client";
import type { Editor } from "@tiptap/core";
import type { Node as PmNode } from "@tiptap/pm/model";
import { CellSelection } from "@tiptap/pm/tables";
import { useEditorState } from "@tiptap/react";
import {
	BetweenHorizontalEnd,
	BetweenHorizontalStart,
	BetweenVerticalEnd,
	BetweenVerticalStart,
	Columns3,
	MoveHorizontal,
	Rows3,
	TableCellsMerge,
	TableCellsSplit,
} from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Separator } from "../ui/separator";
import { BLOCK_TOOLBAR } from "./blocks/shared";
import { editorMessages } from "./messages";
import { ToolbarButton, type ToolbarItem } from "./toolbar-button";

const t = createTranslator(editorMessages);

const chain = (editor: Editor) => editor.chain().focus();
const isCellSelection = (editor: Editor): boolean => editor.state.selection instanceof CellSelection;

/** 선택이 들어 있는 표 노드와 그 위치. 표 밖이면 null. */
const findTable = (editor: Editor): { node: PmNode; pos: number } | null => {
	const { $from } = editor.state.selection;
	for (let depth = $from.depth; depth > 0; depth -= 1) {
		const node = $from.node(depth);
		if (node.type.name === "table") return { node, pos: $from.before(depth) };
	}
	return null;
};

const isCell = (node: PmNode) => node.type.name === "tableCell" || node.type.name === "tableHeader";
const hasFixedWidth = (table: PmNode) => {
	let fixed = false;
	table.descendants((node) => {
		if (isCell(node) && Array.isArray(node.attrs.colwidth) && node.attrs.colwidth.some((width: number) => width > 0))
			fixed = true;
		return !fixed && !isCell(node);
	});
	return fixed;
};

/**
 * 열 너비를 모두 지운다. 너비가 없는 표는 본문 폭을 꽉 채운다(공개 화면도 같다).
 * 이후 한 열만 끌어 조절해도 나머지 열이 자동이라 표는 계속 꽉 찬다.
 */
const fillTableWidth = (editor: Editor) => {
	const table = findTable(editor);
	if (!table) return;
	const tr = editor.state.tr;
	table.node.descendants((node, offset) => {
		if (isCell(node) && node.attrs.colwidth)
			tr.setNodeMarkup(table.pos + 1 + offset, undefined, { ...node.attrs, colwidth: null });
		return !isCell(node);
	});
	editor.view.dispatch(tr);
	editor.commands.focus();
};

/** 표 안에 커서가 있을 때 표 위에 뜨는 조작 도구(§4.1, v2 C6). 표 삭제는 블록 손잡이 메뉴에 있다. */
const TABLE_TOOL_GROUPS: ToolbarItem[][] = [
	[
		{
			label: t("tableToolbar.addRowBeforeLabel"),
			title: t("tableToolbar.addRowBefore"),
			icon: BetweenHorizontalStart,
			run: (e) => chain(e).addRowBefore().run(),
		},
		{
			label: t("tableToolbar.addRowAfterLabel"),
			title: t("tableToolbar.addRowAfter"),
			icon: BetweenHorizontalEnd,
			run: (e) => chain(e).addRowAfter().run(),
		},
		{
			label: t("tableToolbar.addColumnBeforeLabel"),
			title: t("tableToolbar.addColumnBefore"),
			icon: BetweenVerticalStart,
			run: (e) => chain(e).addColumnBefore().run(),
		},
		{
			label: t("tableToolbar.addColumnAfterLabel"),
			title: t("tableToolbar.addColumnAfter"),
			icon: BetweenVerticalEnd,
			run: (e) => chain(e).addColumnAfter().run(),
		},
	],
	[
		{
			label: t("tableToolbar.deleteRow"),
			icon: Rows3,
			className: "text-cms-destructive",
			run: (e) => chain(e).deleteRow().run(),
		},
		{
			label: t("tableToolbar.deleteColumn"),
			icon: Columns3,
			className: "text-cms-destructive",
			run: (e) => chain(e).deleteColumn().run(),
		},
	],
	[
		{
			label: t("tableToolbar.mergeCells"),
			title: t("tableToolbar.mergeCells"),
			icon: TableCellsMerge,
			isDisabled: (e) => !isCellSelection(e) || !e.can().mergeCells(),
			run: (e) => chain(e).mergeCells().run(),
		},
		{
			label: t("tableToolbar.splitCell"),
			title: t("tableToolbar.splitCell"),
			icon: TableCellsSplit,
			isDisabled: (e) => !isCellSelection(e) || !e.can().splitCell(),
			run: (e) => chain(e).splitCell().run(),
		},
	],
	[
		{
			label: t("tableToolbar.fillWidth"),
			title: t("tableToolbar.fillWidth"),
			icon: MoveHorizontal,
			isDisabled: (e) => {
				const table = findTable(e);
				return !table || !hasFixedWidth(table.node);
			},
			run: fillTableWidth,
		},
	],
];

const TOOLBAR_GAP = 6;

export function TableToolbar({ editor }: { editor: Editor }) {
	// 선택·문서가 바뀔 때마다(셀 이동, 병합 가능 여부, 열 너비) 다시 그린다. 표 밖이면 null.
	const tableKey = useEditorState({
		editor,
		selector: ({ editor: current }) => {
			if (!current?.isEditable || !current.isActive("table")) return null;
			const table = findTable(current);
			const { from, to } = current.state.selection;
			return `${table?.pos}:${from}:${to}:${isCellSelection(current)}:${table?.node.nodeSize}:${table ? hasFixedWidth(table.node) : ""}`;
		},
	});
	const toolbarRef = useRef<HTMLDivElement>(null);
	const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
	const [, setScrollTick] = useState(0);

	// 스크롤·창 크기 변경에도 표를 따라간다(도구 줄은 화면 고정 위치로 띄운다).
	useEffect(() => {
		if (!tableKey) return;
		const update = () => setScrollTick((tick) => tick + 1);
		window.addEventListener("scroll", update, true);
		window.addEventListener("resize", update);
		return () => {
			window.removeEventListener("scroll", update, true);
			window.removeEventListener("resize", update);
		};
	}, [tableKey]);

	useLayoutEffect(() => {
		if (!tableKey) {
			setPosition(null);
			return;
		}
		const table = findTable(editor);
		const dom = table ? editor.view.nodeDOM(table.pos) : null;
		const element = dom instanceof HTMLElement ? dom : null;
		const toolbar = toolbarRef.current;
		if (!element) {
			setPosition(null);
			return;
		}
		const rect = element.getBoundingClientRect();
		const height = toolbar?.offsetHeight ?? 32;
		const width = toolbar?.offsetWidth ?? 0;
		// 위쪽 서식 도구(sticky)에 가리지 않게, 표가 위로 스크롤되면 서식 도구 바로 아래에 붙는다.
		const formatBar = editor.view.dom
			.closest("[data-cms-editor-shell]")
			?.querySelector(`[role="toolbar"][aria-label="${t("toolbar.format")}"]`);
		const minTop = (formatBar?.getBoundingClientRect().bottom ?? 0) + TOOLBAR_GAP;
		const top = Math.min(Math.max(rect.top - height - TOOLBAR_GAP, minTop), rect.bottom - height);
		const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
		setPosition((previous) => (previous && previous.top === top && previous.left === left ? previous : { top, left }));
	});

	if (!tableKey || typeof window === "undefined") return null;

	return createPortal(
		<div
			ref={toolbarRef}
			role="toolbar"
			aria-label={t("tableToolbar.label")}
			style={{ position: "fixed", top: position?.top ?? -9999, left: position?.left ?? -9999, zIndex: 30 }}
			className={BLOCK_TOOLBAR}
		>
			{TABLE_TOOL_GROUPS.map((group, index) => (
				<div key={group[0]?.label} className="flex items-center gap-0.5">
					{index > 0 && <Separator orientation="vertical" className="mx-0.5 h-4" />}
					{group.map((item) => (
						<ToolbarButton key={item.label} editor={editor} item={item} />
					))}
				</div>
			))}
		</div>,
		document.body,
	);
}
