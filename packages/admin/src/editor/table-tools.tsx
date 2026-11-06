import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	EditorOverlay,
	TableAddStrip,
	TableColumnBorder,
	TableGrip,
} from "@monti-cms/ui";
import { ColumnInsert, RowInsert, TrashCan } from "@monti-cms/ui/icons";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { CellSelection, TableMap } from "@tiptap/pm/tables";
import { type Editor, useEditorState } from "@tiptap/react";
import { useEffect, useRef, useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { ownShares, setShares, sharesAfter, sharesNow, tradeShares } from "./table";

/** The hit area over a column border (px): wide enough to catch, the line inside it 2px. */
const BORDER = 9;
/** How far an arrow key moves a border (percent of the body), and with Shift. */
const KEY_STEP = 2;
const KEY_STEP_LARGE = 10;

/** A border being dragged: whose table, which border, where the drag started and the shares then. */
type Drag = { tablePos: number; at: number; startX: number; x: number; width: number; shares: number[] };

/** How far the + strips sit from the table's edge, and how thick they are. */
const STRIP_GAP = 4;
const STRIP = 16;

type Caret = { tablePos: number; row: number; column: number; rows: number; columns: number };

/** The table the caret is in, and which of its cells. */
function caretOf(editor: Editor): Caret | null {
	const { $from } = editor.state.selection;
	for (let depth = $from.depth; depth > 0; depth--) {
		const node = $from.node(depth);
		if (node.type.name !== "table") continue;
		const tablePos = $from.before(depth);
		const map = TableMap.get(node);
		const cellDepth = depth + 2;
		if ($from.depth < cellDepth) return null;
		const rect = map.findCell($from.before(cellDepth) - tablePos - 1);
		return { tablePos, row: rect.top, column: rect.left, rows: map.height, columns: map.width };
	}
	return null;
}

/** The table's own `<table>`: the editor puts it in a wrapper that scrolls a wide table. */
function tableElement(editor: Editor, pos: number): HTMLTableElement | null {
	const dom = editor.view.nodeDOM(pos);
	if (!(dom instanceof HTMLElement)) return null;
	return dom instanceof HTMLTableElement ? dom : dom.querySelector("table");
}

/** The position of a cell's text start, by row and column. */
function cellStart(table: EditorNode, tablePos: number, row: number, column: number) {
	const map = TableMap.get(table);
	return tablePos + 1 + map.map[row * map.width + column] + 1;
}

/**
 * Editing a table in the body (editor-tools.md, the table; T62): with the caret in a cell, a grip on the top edge of its column and on the left edge
 * of its row opens that column's or row's menu, and picks it whole while the menu is open. While the pointer is over a table, a + strip on its right
 * edge adds a column and one on its bottom edge adds a row.
 */
export function useTableTools(editor: Editor | null) {
	const { t } = useAdmin();
	const [hovered, setHovered] = useState<number | null>(null);
	const [menu, setMenu] = useState<"column" | "row" | null>(null);
	const [drag, setDrag] = useState<Drag | null>(null);
	// The tools sit at measured points of the screen: they follow the page when it scrolls or the window changes size.
	const [, setTick] = useState(0);
	const caret = useEditorState({
		editor,
		selector: ({ editor: current }) => (current?.isEditable ? caretOf(current) : null),
		equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
	});
	const shown = caret !== null || hovered !== null;
	useEffect(() => {
		if (!shown) return;
		const update = () => setTick((tick) => tick + 1);
		window.addEventListener("scroll", update, true);
		window.addEventListener("resize", update);
		return () => {
			window.removeEventListener("scroll", update, true);
			window.removeEventListener("resize", update);
		};
	}, [shown]);

	/** Notes the table under the pointer, or none. The + strips stay while the pointer is on them or on its way to them. */
	const point = (target: EventTarget | null, x: number, y: number) => {
		if (!editor || !(target instanceof Element)) return;
		if (target.closest("[data-slot=table-add-strip], [data-slot=table-column-border]")) return;
		const table = target.closest("table");
		if (!table || !editor.view.dom.contains(table)) {
			const current = hovered === null ? null : tableElement(editor, hovered)?.getBoundingClientRect();
			const reach = STRIP_GAP + STRIP;
			const near =
				current && x >= current.left && x <= current.right + reach && y >= current.top && y <= current.bottom + reach;
			if (!near) setHovered(null);
			return;
		}
		const pos = editor.view.posAtDOM(table, 0);
		const $pos = editor.state.doc.resolve(pos);
		for (let depth = $pos.depth; depth > 0; depth--)
			if ($pos.node(depth).type.name === "table") return setHovered($pos.before(depth));
		setHovered(null);
	};
	// The pointer is watched over the whole window: the + strip on the right edge sits outside the body, so leaving the body must not take it away.
	const latestPoint = useRef(point);
	latestPoint.current = point;
	useEffect(() => {
		if (!editor) return;
		const move = (event: MouseEvent) => latestPoint.current(event.target, event.clientX, event.clientY);
		window.addEventListener("mousemove", move);
		return () => window.removeEventListener("mousemove", move);
	}, [editor]);

	if (!editor || !editor.isEditable) return { overlay: null };

	/**
	 * Runs a table command with the caret back in the cell it was in (the grip's menu took the focus). A column put in or taken out changes the
	 * other columns' shares in the same step, so the table stays as wide as the body and undo takes back both.
	 */
	const run = (
		command: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>,
		columns?: { add: number } | { remove: number },
	) => {
		const tablePos = caret?.tablePos;
		const table = tablePos === undefined ? null : editor.state.doc.nodeAt(tablePos);
		const before = table ? ownShares(table) : null;
		let chain = command(editor.chain().focus());
		if (columns && tablePos !== undefined && before)
			chain = chain.command(({ tr }) => {
				setShares(tr, tablePos, sharesAfter(before, columns));
				return true;
			});
		chain.run();
		// The column or row was picked for the menu; after its command the caret is back in one cell.
		const { selection } = editor.state;
		if (selection instanceof CellSelection) editor.commands.setTextSelection(selection.$anchorCell.pos + 1);
		setMenu(null);
	};

	/** Opening a grip's menu picks the whole column or row, so it shows what the menu is about. */
	const pick = (open: boolean, along: "column" | "row") => {
		setMenu(open ? along : null);
		if (!open || !caret) return;
		const table = editor.state.doc.nodeAt(caret.tablePos);
		if (!table) return;
		const $cell = editor.state.doc.resolve(cellStart(table, caret.tablePos, caret.row, caret.column) - 1);
		const selection = along === "column" ? CellSelection.colSelection($cell) : CellSelection.rowSelection($cell);
		editor.view.dispatch(editor.state.tr.setSelection(selection));
	};

	/** Adds a column after the last, or a row after the last, from the + strips. */
	const addAtEnd = (tablePos: number, along: "column" | "row") => {
		const table = editor.state.doc.nodeAt(tablePos);
		if (!table) return;
		const map = TableMap.get(table);
		const at = cellStart(table, tablePos, map.height - 1, map.width - 1);
		editor
			.chain()
			.focus()
			.command(({ tr }) => {
				tr.setSelection(TextSelection.create(tr.doc, at));
				return true;
			})
			.run();
		if (along === "row") {
			editor.chain().addRowAfter().run();
			return;
		}
		const before = ownShares(table);
		editor
			.chain()
			.addColumnAfter()
			.command(({ tr }) => {
				if (before) setShares(tr, tablePos, sharesAfter(before, { add: before.length }));
				return true;
			})
			.run();
	};

	const grips = (() => {
		if (!caret) return null;
		const table = tableElement(editor, caret.tablePos);
		const row = table?.rows[caret.row];
		const cell = row?.cells[caret.column];
		const head = table?.rows[0]?.cells[caret.column];
		if (!table || !row || !cell || !head) return null;
		const box = table.getBoundingClientRect();
		const column = head.getBoundingClientRect();
		const line = row.getBoundingClientRect();
		return (
			<>
				<EditorOverlay top={box.top} left={column.left + column.width / 2} place="center">
					<DropdownMenu open={menu === "column"} onOpenChange={(open) => pick(open, "column")} modal={false}>
						<TableGrip
							along="column"
							label={t("table.column", { n: caret.column + 1 })}
							active={menu === "column"}
							trigger={(grip) => <DropdownMenuTrigger render={grip} />}
						/>
						<DropdownMenuContent side="bottom" align="start" sideOffset={6}>
							<DropdownMenuItem onClick={() => run((chain) => chain.addColumnBefore(), { add: caret.column })}>
								<ColumnInsert aria-hidden />
								{t("table.columnBefore")}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => run((chain) => chain.addColumnAfter(), { add: caret.column + 1 })}>
								<ColumnInsert aria-hidden />
								{t("table.columnAfter")}
							</DropdownMenuItem>
							{caret.columns > 1 ? (
								<>
									<DropdownMenuSeparator />
									{/* Not red: a deleted column comes back with undo. */}
									<DropdownMenuItem onClick={() => run((chain) => chain.deleteColumn(), { remove: caret.column })}>
										<TrashCan aria-hidden />
										{t("table.deleteColumn")}
									</DropdownMenuItem>
								</>
							) : null}
						</DropdownMenuContent>
					</DropdownMenu>
				</EditorOverlay>
				<EditorOverlay top={line.top + line.height / 2} left={box.left} place="center">
					<DropdownMenu open={menu === "row"} onOpenChange={(open) => pick(open, "row")} modal={false}>
						<TableGrip
							along="row"
							label={t("table.row", { n: caret.row + 1 })}
							active={menu === "row"}
							trigger={(grip) => <DropdownMenuTrigger render={grip} />}
						/>
						<DropdownMenuContent side="right" align="start" sideOffset={6}>
							<DropdownMenuItem onClick={() => run((chain) => chain.addRowBefore())}>
								<RowInsert aria-hidden />
								{t("table.rowBefore")}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => run((chain) => chain.addRowAfter())}>
								<RowInsert aria-hidden />
								{t("table.rowAfter")}
							</DropdownMenuItem>
							{caret.rows > 1 ? (
								<>
									<DropdownMenuSeparator />
									<DropdownMenuItem onClick={() => run((chain) => chain.deleteRow())}>
										<TrashCan aria-hidden />
										{t("table.deleteRow")}
									</DropdownMenuItem>
								</>
							) : null}
						</DropdownMenuContent>
					</DropdownMenu>
				</EditorOverlay>
			</>
		);
	})();

	/** Sets a table's shares in one step that undo takes back. */
	const reshare = (tablePos: number, shares: number[]) => {
		const tr = editor.state.tr;
		setShares(tr, tablePos, shares);
		editor.view.dispatch(tr);
	};

	/**
	 * The borders between columns, of the table the caret is in or the pointer is over: dragging one (or its arrow keys) trades width between the two
	 * columns beside it, and the table stays as wide as the body. While dragged, the line follows the pointer; the widths change when it is let go.
	 */
	const borders = (() => {
		const tablePos = drag?.tablePos ?? caret?.tablePos ?? hovered;
		if (tablePos === null || tablePos === undefined) return null;
		const node = editor.state.doc.nodeAt(tablePos);
		const table = tableElement(editor, tablePos);
		if (!node || node.type.name !== "table" || !table) return null;
		const box = table.getBoundingClientRect();
		const shares = sharesNow(node);
		const moved = drag ? tradeShares(drag.shares, drag.at, ((drag.x - drag.startX) / drag.width) * 100) : null;
		return shares.slice(0, -1).map((_, at) => {
			const now = moved && drag?.at === at ? moved : shares;
			const x = box.left + (now.slice(0, at + 1).reduce((sum, share) => sum + share, 0) / 100) * box.width;
			return (
				// biome-ignore lint/suspicious/noArrayIndexKey: a border is its place between two columns
				<EditorOverlay key={at} top={box.top} left={x - BORDER / 2} width={BORDER} height={box.height}>
					<TableColumnBorder
						label={t("table.border", { left: at + 1, right: at + 2 })}
						active={drag?.at === at}
						onPointerDown={(event) => {
							event.currentTarget.setPointerCapture(event.pointerId);
							setDrag({ tablePos, at, startX: event.clientX, x: event.clientX, width: box.width, shares });
						}}
						onPointerMove={(event) => {
							if (drag?.at === at) setDrag({ ...drag, x: event.clientX });
						}}
						onPointerUp={() => {
							if (drag?.at === at && moved && drag.x !== drag.startX) reshare(tablePos, moved);
							setDrag(null);
						}}
						onKeyDown={(event) => {
							if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
							event.preventDefault();
							const step = (event.shiftKey ? KEY_STEP_LARGE : KEY_STEP) * (event.key === "ArrowLeft" ? -1 : 1);
							reshare(tablePos, tradeShares(shares, at, step));
						}}
					/>
				</EditorOverlay>
			);
		});
	})();

	const strips = (() => {
		if (hovered === null) return null;
		const table = tableElement(editor, hovered);
		if (!table) return null;
		const box = table.getBoundingClientRect();
		return (
			<>
				<EditorOverlay top={box.top} left={box.right + STRIP_GAP} width={STRIP} height={box.height}>
					<TableAddStrip label={t("table.addColumn")} onClick={() => addAtEnd(hovered, "column")} />
				</EditorOverlay>
				<EditorOverlay top={box.bottom + STRIP_GAP} left={box.left} width={box.width} height={STRIP}>
					<TableAddStrip label={t("table.addRow")} onClick={() => addAtEnd(hovered, "row")} />
				</EditorOverlay>
			</>
		);
	})();

	return {
		overlay: (
			<>
				{grips}
				{borders}
				{strips}
			</>
		),
	};
}
