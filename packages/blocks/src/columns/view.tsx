"use client";

import { ContainerToolbar, ToolbarButton } from "@monti-cms/admin/blocks";
import { BlockFrame, Content, useBlockEditor } from "@monti-cms/admin/hooks";
import { cn } from "@monti-cms/admin/kit";
import { useTranslator } from "@monti-cms/core/client";
import { Columns2, GripVertical, Plus, Trash2 } from "lucide-react";
import { type CSSProperties, type PointerEvent, useLayoutEffect, useRef, useState } from "react";
import {
	columnsGridTemplate,
	formatColumnWidths,
	MIN_COLUMN_PERCENT,
	parseColumnWidths,
	toPercentWidths,
} from "./layout";
import { columnsMessages } from "./messages";

type Boundary = { index: number; left: number };

/**
 * Places columns side by side like the public page and edits each column in place (grid on wide screens, stacked on narrow ones).
 * The child columns sit directly inside the content's first element (see `Content`), so the grid is applied there.
 * Dragging the boundary between columns changes the width ratios, and the toolbar resets them to an equal split.
 */
export function ColumnsNodeView() {
	const t = useTranslator(columnsMessages);
	const block = useBlockEditor();
	const { values, editable } = block;
	const count = block.children.length;
	const saved = parseColumnWidths(values.widths, count);
	// Ratios used only while dragging. Saved in one step on release (a single undo step).
	const [draft, setDraft] = useState<number[] | null>(null);
	const widths = draft ?? (saved ? toPercentWidths(saved, count) : null);
	const [boundaries, setBoundaries] = useState<Boundary[]>([]);
	const wrapperRef = useRef<HTMLDivElement>(null);
	const selectedIndex = block.focusedChild ?? -1;

	/** The element that directly holds the column blocks: the first element inside the content (`Content`'s DOM contract). */
	const holder = () => wrapperRef.current?.querySelector<HTMLElement>(":scope > [data-cms-block-content] > *");

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
		block.setValue("widths", next ? formatColumnWidths(next) : "");
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
		// When the column count changes, the previous ratios no longer fit. Reset to an equal split, in the same undo step.
		const added = block.transact((tx) => {
			tx.addChild();
			tx.setValue("widths", "");
		});
		if (added.ok) block.focus({ child: count });
	};

	const removeColumn = () => {
		// Deletes the column with the cursor. If the cursor is outside the columns, deletes the last column.
		const index = selectedIndex === -1 ? count - 1 : selectedIndex;
		const removed = block.transact((tx) => {
			tx.removeChild(index);
			tx.setValue("widths", "");
		});
		if (removed.ok) block.focus({ child: Math.max(0, index - 1) });
	};

	return (
		<BlockFrame ref={wrapperRef} className="my-6 rounded-md">
			<Content
				style={{ "--cms-columns": columnsGridTemplate(widths, count) } as CSSProperties}
				// The top padding keeps the toolbar (-top-3.5) from covering the first line of text.
				// Write the classes out literally instead of assembling them so Tailwind can find them.
				className={cn(
					"pt-3 [&>*]:flex [&>*]:flex-col [&>*]:gap-4",
					"md:[&>*]:grid md:[&>*]:items-start md:[&>*]:gap-6 md:[&>*]:[grid-template-columns:var(--cms-columns)]",
					"[&>*>*]:min-w-0",
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
					<ToolbarButton label={t("add")} disabled={!block.canAddChild} onClick={addColumn}>
						<Plus aria-hidden />
					</ToolbarButton>
					<ToolbarButton
						label={selectedIndex === -1 ? t("deleteLast") : t("delete")}
						destructive
						disabled={!block.canRemoveChild(selectedIndex === -1 ? count - 1 : selectedIndex)}
						onClick={removeColumn}
					>
						<Trash2 aria-hidden />
					</ToolbarButton>
				</ContainerToolbar>
			) : null}
		</BlockFrame>
	);
}

/** One column. The boundary shows as a dotted line only on hover or when the cursor is inside. */
export function ColumnNodeView() {
	return (
		<BlockFrame
			framed={false}
			selectedRing={false}
			className="h-full rounded-md outline-dashed outline-1 outline-transparent transition-colors focus-within:outline-cms-ring/60 group-hover/container:outline-cms-border"
		>
			<Content className="min-h-8 px-2 py-1 [&>*>:first-child]:mt-0 [&>*>:last-child]:mb-0" />
		</BlockFrame>
	);
}
