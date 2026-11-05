import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
	EditorOverlay,
	TableAddStrip,
	TableGrip,
} from "@monti-cms/ui";
import { ColumnInsert, RowInsert, TrashCan } from "@monti-cms/ui/icons";
import type { Node as EditorNode } from "@tiptap/pm/model";
import { TextSelection } from "@tiptap/pm/state";
import { CellSelection, TableMap } from "@tiptap/pm/tables";
import { type Editor, useEditorState } from "@tiptap/react";
import { useEffect, useState } from "react";
import { useAdmin } from "../operations/admin-context";

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
 * edge adds a column and one on its bottom edge adds a row. `point` is told where the pointer is.
 */
export function useTableTools(editor: Editor | null) {
	const { t } = useAdmin();
	const [hovered, setHovered] = useState<number | null>(null);
	const [menu, setMenu] = useState<"column" | "row" | null>(null);
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
		if (target.closest("[data-slot=table-add-strip]")) return;
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
	const leave = () => setHovered(null);

	if (!editor || !editor.isEditable) return { point, leave, overlay: null };

	/** Runs a table command with the caret back in the cell it was in (the grip's menu took the focus). */
	const run = (command: (chain: ReturnType<Editor["chain"]>) => ReturnType<Editor["chain"]>) => {
		command(editor.chain().focus()).run();
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
		if (along === "column") editor.chain().addColumnAfter().run();
		else editor.chain().addRowAfter().run();
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
							<DropdownMenuItem onClick={() => run((chain) => chain.addColumnBefore())}>
								<ColumnInsert aria-hidden />
								{t("table.columnBefore")}
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => run((chain) => chain.addColumnAfter())}>
								<ColumnInsert aria-hidden />
								{t("table.columnAfter")}
							</DropdownMenuItem>
							{caret.columns > 1 ? (
								<>
									<DropdownMenuSeparator />
									{/* Not red: a deleted column comes back with undo. */}
									<DropdownMenuItem onClick={() => run((chain) => chain.deleteColumn())}>
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
		point,
		leave,
		overlay: (
			<>
				{grips}
				{strips}
			</>
		),
	};
}
