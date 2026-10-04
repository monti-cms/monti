"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createTranslator } from "@monti-cms/core/client";
import { CellSelection } from "@tiptap/pm/tables";
import { useEditorState } from "@tiptap/react";
import { BetweenHorizontalEnd, BetweenHorizontalStart, BetweenVerticalEnd, BetweenVerticalStart, Columns3, MoveHorizontal, Rows3, TableCellsMerge, TableCellsSplit, } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Separator } from "../ui/separator.js";
import { BLOCK_TOOLBAR } from "./blocks/shared.js";
import { editorMessages } from "./messages.js";
import { ToolbarButton } from "./toolbar-button.js";
const t = createTranslator(editorMessages);
const chain = (editor) => editor.chain().focus();
const isCellSelection = (editor) => editor.state.selection instanceof CellSelection;
/** The table node containing the selection and its position. null when outside a table. */
const findTable = (editor) => {
    const { $from } = editor.state.selection;
    for (let depth = $from.depth; depth > 0; depth -= 1) {
        const node = $from.node(depth);
        if (node.type.name === "table")
            return { node, pos: $from.before(depth) };
    }
    return null;
};
const isCell = (node) => node.type.name === "tableCell" || node.type.name === "tableHeader";
const hasFixedWidth = (table) => {
    let fixed = false;
    table.descendants((node) => {
        if (isCell(node) && Array.isArray(node.attrs.colwidth) && node.attrs.colwidth.some((width) => width > 0))
            fixed = true;
        return !fixed && !isCell(node);
    });
    return fixed;
};
/**
 * Clears all column widths. A table without widths fills the full body width (same on the public page).
 * Even if a single column is dragged to resize afterward, the rest are auto, so the table still fills the width.
 */
const fillTableWidth = (editor) => {
    const table = findTable(editor);
    if (!table)
        return;
    const tr = editor.state.tr;
    table.node.descendants((node, offset) => {
        if (isCell(node) && node.attrs.colwidth)
            tr.setNodeMarkup(table.pos + 1 + offset, undefined, { ...node.attrs, colwidth: null });
        return !isCell(node);
    });
    editor.view.dispatch(tr);
    editor.commands.focus();
};
/** Controls floating above the table while the cursor is inside it. Deleting the table is in the block handle menu. */
const TABLE_TOOL_GROUPS = [
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
export function TableToolbar({ editor }) {
    // Re-render whenever the selection or document changes (cell movement, mergeability, column widths). null outside a table.
    const tableKey = useEditorState({
        editor,
        selector: ({ editor: current }) => {
            if (!current?.isEditable || !current.isActive("table"))
                return null;
            const table = findTable(current);
            const { from, to } = current.state.selection;
            return `${table?.pos}:${from}:${to}:${isCellSelection(current)}:${table?.node.nodeSize}:${table ? hasFixedWidth(table.node) : ""}`;
        },
    });
    const toolbarRef = useRef(null);
    const [position, setPosition] = useState(null);
    const [, setScrollTick] = useState(0);
    // Follow the table on scroll and window resize (the tool row floats at a fixed screen position).
    useEffect(() => {
        if (!tableKey)
            return;
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
        // So it is not hidden by the top formatting toolbar (sticky), when the table scrolls up it sticks right below the formatting toolbar.
        const formatBar = editor.view.dom
            .closest("[data-cms-editor-shell]")
            ?.querySelector(`[role="toolbar"][aria-label="${t("toolbar.format")}"]`);
        const minTop = (formatBar?.getBoundingClientRect().bottom ?? 0) + TOOLBAR_GAP;
        const top = Math.min(Math.max(rect.top - height - TOOLBAR_GAP, minTop), rect.bottom - height);
        const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
        setPosition((previous) => (previous && previous.top === top && previous.left === left ? previous : { top, left }));
    });
    if (!tableKey || typeof window === "undefined")
        return null;
    return createPortal(_jsx("div", { ref: toolbarRef, role: "toolbar", "aria-label": t("tableToolbar.label"), style: { position: "fixed", top: position?.top ?? -9999, left: position?.left ?? -9999, zIndex: 30 }, className: BLOCK_TOOLBAR, children: TABLE_TOOL_GROUPS.map((group, index) => (_jsxs("div", { className: "flex items-center gap-0.5", children: [index > 0 && _jsx(Separator, { orientation: "vertical", className: "mx-0.5 h-4" }), group.map((item) => (_jsx(ToolbarButton, { editor: editor, item: item }, item.label)))] }, group[0]?.label))) }), document.body);
}
