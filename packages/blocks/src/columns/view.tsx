"use client";

import {
	blockNodeName,
	ContainerToolbar,
	childPos,
	focusInside,
	SELECTED_RING,
	ToolbarButton,
	useSelectedChildIndex,
	valuesOf,
	withValue,
} from "@monti-cms/admin/blocks";
import { cn } from "@monti-cms/admin/kit";
import { createTranslator } from "@monti-cms/core/client";
import { NodeViewContent, type NodeViewProps, NodeViewWrapper } from "@tiptap/react";
import { Columns2, GripVertical, Plus, Trash2 } from "lucide-react";
import { type CSSProperties, type PointerEvent, useLayoutEffect, useRef, useState } from "react";
import { columnBlock, columnsBlock as columnsDefinition } from "./definition";
import {
	columnsGridTemplate,
	formatColumnWidths,
	MIN_COLUMN_PERCENT,
	parseColumnWidths,
	toPercentWidths,
} from "./layout";
import { columnsMessages } from "./messages";

const t = createTranslator(columnsMessages);

const MIN_COLUMNS = columnsDefinition.children.min;
const MAX_COLUMNS = columnsDefinition.children.max;

type Boundary = { index: number; left: number };

/**
 * Places columns side by side like the public page and edits each column in place (grid on wide screens, stacked on narrow ones).
 * Child columns are direct children of the contentDOM (`data-node-view-content-react`), so the grid is applied there.
 * Dragging the boundary between columns changes the width ratios, and the toolbar resets them to an equal split.
 */
export function ColumnsNodeView(props: NodeViewProps) {
	const { node, selected, editor, getPos } = props;
	const values = valuesOf(node);
	const count = node.childCount;
	const saved = parseColumnWidths(values.widths, count);
	// Ratios used only while dragging. Saved in one step on release (a single undo step).
	const [draft, setDraft] = useState<number[] | null>(null);
	const widths = draft ?? (saved ? toPercentWidths(saved, count) : null);
	const [boundaries, setBoundaries] = useState<Boundary[]>([]);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const selectedIndex = useSelectedChildIndex(editor, getPos);
	const editable = editor.isEditable;

	const holder = () =>
		wrapperRef.current?.querySelector<HTMLElement>(
			":scope > [data-node-view-content] > [data-node-view-content-react]",
		);

	// Measures the column boundary positions. On narrow screens (stacked vertically) no boundary handles are placed.
	useLayoutEffect(() => {
		const wrapper = wrapperRef.current;
		const content = holder();
		if (!wrapper || !content) return;
		const measure = () => {
			if (getComputedStyle(content).display !== "grid") {
				setBoundaries((previous) => (previous.length ? [] : previous));
				return;
			}
			const base = wrapper.getBoundingClientRect().left;
			const cells = Array.from(content.children).map((child) => child.getBoundingClientRect());
			const next = cells.slice(0, -1).map((cell, index) => ({
				index,
				left: (cell.right + (cells[index + 1]?.left ?? cell.right)) / 2 - base,
			}));
			setBoundaries((previous) =>
				previous.length === next.length && previous.every((item, i) => Math.abs(item.left - (next[i]?.left ?? 0)) < 0.5)
					? previous
					: next,
			);
		};
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(wrapper);
		return () => observer.disconnect();
	});

	const setColumns = (next: number[] | null) => {
		const pos = getPos();
		if (typeof pos !== "number") return;
		const current = editor.state.doc.nodeAt(pos);
		if (!current) return;
		editor.view.dispatch(
			editor.state.tr.setNodeMarkup(pos, undefined, {
				...current.attrs,
				values: withValue(valuesOf(current), "widths", next ? formatColumnWidths(next) : ""),
			}),
		);
	};

	/** Moves a boundary by a ratio (%) (keyboard). The columns on both sides never shrink below the minimum ratio. */
	const nudge = (index: number, delta: number) => {
		const start = widths ?? toPercentWidths(null, count);
		const pair = (start[index] ?? 0) + (start[index + 1] ?? 0);
		const left = Math.min(Math.max((start[index] ?? 0) + delta, MIN_COLUMN_PERCENT), pair - MIN_COLUMN_PERCENT);
		setColumns(start.map((width, i) => (i === index ? left : i === index + 1 ? pair - left : width)));
	};

	const startResize = (index: number, event: PointerEvent<HTMLButtonElement>) => {
		const content = holder();
		if (!editable || !content) return;
		event.preventDefault();
		const target = event.currentTarget;
		target.setPointerCapture(event.pointerId);
		const start = widths ?? toPercentWidths(null, count);
		const gap = Number.parseFloat(getComputedStyle(content).columnGap) || 0;
		const pxPerPercent = (content.getBoundingClientRect().width - gap * (count - 1)) / 100;
		const startX = event.clientX;
		const pair = (start[index] ?? 0) + (start[index + 1] ?? 0);
		let latest = start;

		const move = (moveEvent: globalThis.PointerEvent) => {
			const delta = (moveEvent.clientX - startX) / pxPerPercent;
			const left = Math.round(
				Math.min(Math.max((start[index] ?? 0) + delta, MIN_COLUMN_PERCENT), pair - MIN_COLUMN_PERCENT),
			);
			latest = start.map((width, i) => (i === index ? left : i === index + 1 ? pair - left : width));
			setDraft(latest);
		};
		const end = () => {
			target.removeEventListener("pointermove", move);
			target.removeEventListener("pointerup", end);
			target.removeEventListener("pointercancel", end);
			setDraft(null);
			if (latest !== start) setColumns(latest);
		};
		target.addEventListener("pointermove", move);
		target.addEventListener("pointerup", end);
		target.addEventListener("pointercancel", end);
	};

	const addColumn = () => {
		const pos = getPos();
		if (typeof pos !== "number" || count >= MAX_COLUMNS) return;
		editor
			.chain()
			.insertContentAt(pos + node.nodeSize - 1, { type: blockNodeName(columnBlock), content: [{ type: "paragraph" }] })
			// When the column count changes, the previous ratios no longer fit. Reset to an equal split.
			.command(({ tr }) => {
				const current = tr.doc.nodeAt(pos);
				if (current)
					tr.setNodeMarkup(pos, undefined, { ...current.attrs, values: withValue(valuesOf(current), "widths", "") });
				return true;
			})
			.run();
		focusInside(editor, getPos, count);
	};

	const removeColumn = () => {
		const pos = getPos();
		if (typeof pos !== "number" || count <= MIN_COLUMNS) return;
		// Deletes the column with the cursor. If the cursor is outside the columns, deletes the last column.
		const index = selectedIndex === -1 ? count - 1 : selectedIndex;
		const from = childPos(node, pos, index);
		const tr = editor.state.tr.delete(from, from + node.child(index).nodeSize);
		tr.setNodeMarkup(pos, undefined, { ...node.attrs, values: withValue(values, "widths", "") });
		editor.view.dispatch(tr);
		focusInside(editor, getPos, Math.max(0, index - 1));
	};

	return (
		<NodeViewWrapper
			ref={wrapperRef}
			data-cms-container-node="cmsColumns"
			data-cms-framed
			className={cn("group/container relative my-6 rounded-md", selected && SELECTED_RING)}
		>
			<NodeViewContent
				style={{ "--cms-columns": columnsGridTemplate(widths, count) } as CSSProperties}
				// The top padding keeps the toolbar (-top-3.5) from covering the first line of text.
				// Write the classes out literally instead of assembling them so Tailwind can find them.
				className={cn(
					"pt-3 [&>[data-node-view-content-react]]:flex [&>[data-node-view-content-react]]:flex-col [&>[data-node-view-content-react]]:gap-4",
					"md:[&>[data-node-view-content-react]]:grid md:[&>[data-node-view-content-react]]:items-start md:[&>[data-node-view-content-react]]:gap-6 md:[&>[data-node-view-content-react]]:[grid-template-columns:var(--cms-columns)]",
					"[&>[data-node-view-content-react]>*]:min-w-0",
				)}
			/>
			{editable
				? boundaries.map((boundary) => (
						// The boundary line is display only. The drag handle sits in the column's top padding (pt-3) — in the gap between columns,
						// the block handle (⋮⋮) appears from the second column on, so using the whole boundary as a handle would overlap the block handle.
						<div
							key={boundary.index}
							contentEditable={false}
							style={{ left: boundary.left }}
							className="pointer-events-none absolute top-0 bottom-0 z-10 w-0 -translate-x-1/2"
						>
							<span
								aria-hidden
								className={cn(
									"absolute top-3 bottom-0 left-0 w-0.5 -translate-x-1/2 rounded-full bg-cms-primary opacity-0 transition-opacity group-hover/container:opacity-30",
									draft && "opacity-100 group-hover/container:opacity-100",
								)}
							/>
							<button
								type="button"
								aria-label={t("resize", { from: boundary.index + 1, to: boundary.index + 2 })}
								onPointerDown={(event) => startResize(boundary.index, event)}
								onKeyDown={(event) => {
									if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
									event.preventDefault();
									nudge(boundary.index, event.key === "ArrowLeft" ? -5 : 5);
								}}
								className={cn(
									"pointer-events-auto absolute top-0 left-0 flex h-3 w-6 -translate-x-1/2 cursor-col-resize touch-none items-center justify-center rounded-full border bg-cms-popover opacity-0 shadow-sm transition-opacity",
									"focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-cms-ring group-hover/container:opacity-100",
									draft && "opacity-100",
								)}
							>
								<GripVertical aria-hidden className="size-2.5 rotate-90 text-cms-muted-foreground" />
							</button>
						</div>
					))
				: null}
			{editable ? (
				<ContainerToolbar label={t("toolbar")} visible={!!draft}>
					<span className="px-1.5 text-cms-muted-foreground text-xs tabular-nums">
						{widths ? widths.join(" : ") : t("count", { count })}
					</span>
					<ToolbarButton label={t("equalize")} disabled={!saved} onClick={() => setColumns(null)}>
						<Columns2 aria-hidden />
					</ToolbarButton>
					<ToolbarButton label={t("add")} disabled={count >= MAX_COLUMNS} onClick={addColumn}>
						<Plus aria-hidden />
					</ToolbarButton>
					<ToolbarButton
						label={selectedIndex === -1 ? t("deleteLast") : t("delete")}
						destructive
						disabled={count <= MIN_COLUMNS}
						onClick={removeColumn}
					>
						<Trash2 aria-hidden />
					</ToolbarButton>
				</ContainerToolbar>
			) : null}
		</NodeViewWrapper>
	);
}

/** One column. The boundary shows as a dotted line only on hover or when the cursor is inside. */
export function ColumnNodeView() {
	return (
		<NodeViewWrapper
			data-cms-container-node="cmsColumn"
			className="h-full rounded-md outline-dashed outline-1 outline-transparent transition-colors focus-within:outline-cms-ring/60 group-hover/container:outline-cms-border"
		>
			<NodeViewContent className="min-h-8 px-2 py-1 [&>[data-node-view-content-react]>:first-child]:mt-0 [&>[data-node-view-content-react]>:last-child]:mb-0" />
		</NodeViewWrapper>
	);
}
