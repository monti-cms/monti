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
 * 공개 화면처럼 단을 나란히 놓고 각 단을 그 자리에서 고친다(넓은 화면은 grid, 좁은 화면은 위아래).
 * 자식 단은 contentDOM(`data-node-view-content-react`)의 직계 자식이라 거기에 grid를 건다.
 * 단 사이 경계를 끌어 너비 비율을 바꾸고, 도구 줄에서 똑같이 나누기로 되돌린다.
 */
export function ColumnsNodeView(props: NodeViewProps) {
	const { node, selected, editor, getPos } = props;
	const values = valuesOf(node);
	const count = node.childCount;
	const saved = parseColumnWidths(values.widths, count);
	// 끄는 동안만 쓰는 비율. 놓을 때 한 번에 저장한다(되돌리기 한 번).
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

	// 단 경계 위치를 잰다. 좁은 화면(위아래로 쌓임)에서는 경계 손잡이를 두지 않는다.
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

	/** 경계를 비율(%)만큼 옮긴다(키보드). 양옆 단은 최소 비율 아래로 줄지 않는다. */
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
			// 단 수가 바뀌면 이전 비율은 맞지 않는다. 똑같이 나누기로 돌린다.
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
		// 커서가 있는 단을 지운다. 단 밖이면 마지막 단을 지운다.
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
				// 위쪽 여백은 조작 도구 줄(-top-3.5)이 첫 줄 글자를 가리지 않게 둔다.
				// Tailwind가 찾을 수 있게 클래스를 조립하지 않고 그대로 적는다.
				className={cn(
					"pt-3 [&>[data-node-view-content-react]]:flex [&>[data-node-view-content-react]]:flex-col [&>[data-node-view-content-react]]:gap-4",
					"md:[&>[data-node-view-content-react]]:grid md:[&>[data-node-view-content-react]]:items-start md:[&>[data-node-view-content-react]]:gap-6 md:[&>[data-node-view-content-react]]:[grid-template-columns:var(--cms-columns)]",
					"[&>[data-node-view-content-react]>*]:min-w-0",
				)}
			/>
			{editable
				? boundaries.map((boundary) => (
						// 경계선은 보여 주기만 한다. 끄는 손잡이는 단 위쪽 여백(pt-3)에 둔다 — 단 사이 틈에는
						// 둘째 단부터 블록 핸들(⋮⋮)이 떠서, 경계 전체를 손잡이로 두면 블록 핸들과 겹친다.
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

/** 단 하나. 경계는 마우스를 올리거나 커서가 있을 때만 점선으로 보인다. */
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
