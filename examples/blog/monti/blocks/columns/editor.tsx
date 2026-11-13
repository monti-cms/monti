"use client";

import {
	BlockBar,
	BlockBarButton,
	BlockContent,
	BlockFrame,
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	TableAddStrip,
	TableColumnBorder,
	TableGrip,
	useBarHold,
	useBlock,
} from "@monti-cms/admin/blocks";
import { type CSSProperties, useLayoutEffect, useRef, useState } from "react";
import { columnsGridTemplate, parseColumnWidths } from "./layout";
import { style } from "./style";
import { words } from "./words";

/** Two columns at least; four at most: the old block's, and at the body's 680px no column is narrower than 160px. */
const FEWEST = 2;
const MOST = 4;
/** No column is narrower than this share (%) when a border is dragged; the arrow keys move a border this much. */
const NARROWEST = 10;
const STEP = 5;

const fill = (text: string, values: Record<string, number>) =>
	text.replace(/\{(\w+)\}/g, (whole, name: string) => String(values[name] ?? whole));

/**
 * Columns in the editor (doc 18), with the table's own tools: the border between two columns is dragged (or moved by the arrow keys) to trade their
 * widths, the + strip on the right edge adds a column, and the grip on a column's top edge opens its menu: a column to its left or right, or deleting
 * it (its blocks go to the column beside it). Adding or deleting a column makes them even again; the tool row's "even widths" does too.
 */
export default function ColumnsEditor() {
	const block = useBlock();
	const say = (label: { ko: string; en: string }) => label[block.language];
	const count = block.children.length;
	// Shares of 100, however they were written ("2,1" is "67,33").
	const parsed = parseColumnWidths(block.attrs.widths, count);
	const total = parsed?.reduce((sum, width) => sum + width, 0) ?? 0;
	const saved = parsed && total > 0 ? parsed.map((width) => (width / total) * 100) : null;
	const [dragging, setDragging] = useState<number[] | null>(null);
	const widths = dragging ?? saved ?? Array.from({ length: count }, () => 100 / count);
	const grid = useRef<HTMLDivElement>(null);
	const [edges, setEdges] = useState<{ left: number; width: number }[]>([]);
	const [menu, setMenu] = useState<number | null>(null);
	const hold = useBarHold();

	// Where each column stands in the frame, for the borders and grips over them: again after each drawing and when the frame's width changes.
	const measure = () => {
		const element = grid.current;
		if (!element) return;
		const frame = element.getBoundingClientRect();
		const next = [...element.querySelectorAll<HTMLElement>(".node-column")]
			.filter((each) => each.parentElement?.closest(".monti-block-columns-editor") === element)
			.map((each) => {
				const box = each.getBoundingClientRect();
				return { left: Math.round(box.left - frame.left), width: Math.round(box.width) };
			});
		setEdges((before) => (JSON.stringify(before) === JSON.stringify(next) ? before : next));
	};
	useLayoutEffect(measure);
	// biome-ignore lint/correctness/useExhaustiveDependencies: one observer for the frame's life
	useLayoutEffect(() => {
		const element = grid.current;
		if (!element) return;
		const observer = new ResizeObserver(measure);
		observer.observe(element);
		return () => observer.disconnect();
	}, []);

	const write = (next: number[] | null) =>
		block.setAttrs({ widths: next ? next.map((width) => Math.round(width)).join(",") : undefined });
	const traded = (border: number, share: number) => {
		const next = [...widths];
		const pair = (next[border] ?? 0) + (next[border + 1] ?? 0);
		const left = Math.min(pair - NARROWEST, Math.max(NARROWEST, share));
		next[border] = left;
		next[border + 1] = pair - left;
		return next;
	};
	const startOf = (border: number) => widths.slice(0, border).reduce((sum, width) => sum + width, 0);
	const column = () => ({ type: "column", children: [{ type: "paragraph" }] });

	return (
		<BlockFrame
			bar={
				saved ? (
					<BlockBar label={say(words.tools)}>
						<BlockBarButton label={say(words.even)} named onClick={() => write(null)}>
							{say(words.even)}
						</BlockBarButton>
					</BlockBar>
				) : undefined
			}
		>
			<style href="monti-block-columns" precedence="monti-blocks">
				{style}
			</style>
			<div
				ref={grid}
				className="monti-block-columns monti-block-columns-editor"
				style={{ "--monti-columns": columnsGridTemplate(widths, count) } as CSSProperties}
			>
				<BlockContent className="monti-block-columns-content" />
				{block.editable && (
					<div className="monti-block-columns-tools" contentEditable={false}>
						{edges.slice(0, -1).map((edge, border) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: a border is its place between two columns
								key={border}
								className="monti-block-columns-border"
								style={{ left: (edge.left + edge.width + (edges[border + 1]?.left ?? edge.left + edge.width)) / 2 }}
							>
								<TableColumnBorder
									label={fill(say(words.resize), { n: border + 1, m: border + 2 })}
									active={dragging !== null}
									onPointerDown={(event) => {
										const element = grid.current;
										if (!element) return;
										event.currentTarget.setPointerCapture(event.pointerId);
										const box = element.getBoundingClientRect();
										const share = (x: number) => ((x - box.left) / box.width) * 100 - startOf(border);
										let last: number[] | null = null;
										const move = (moved: PointerEvent) => {
											last = traded(border, share(moved.clientX));
											setDragging(last);
										};
										const end = (keep: boolean) => () => {
											window.removeEventListener("pointermove", move);
											window.removeEventListener("pointerup", up);
											window.removeEventListener("pointercancel", cancel);
											setDragging(null);
											// A press with no move changes nothing.
											if (keep && last) write(last);
										};
										const up = end(true);
										const cancel = end(false);
										window.addEventListener("pointermove", move);
										window.addEventListener("pointerup", up);
										window.addEventListener("pointercancel", cancel);
									}}
									onKeyDown={(event) => {
										if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
										event.preventDefault();
										write(traded(border, (widths[border] ?? 0) + (event.key === "ArrowLeft" ? -STEP : STEP)));
									}}
								/>
							</div>
						))}
						{edges.map((edge, index) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: a grip is its column's place
								key={index}
								className="monti-block-columns-grip"
								data-shown={menu === index || block.childAt === index || undefined}
								style={{ left: edge.left + edge.width / 2 }}
							>
								<DropdownMenu
									onOpenChange={(open) => {
										setMenu(open ? index : null);
										hold(open);
									}}
								>
									<TableGrip
										along="column"
										label={fill(say(words.columnN), { n: index + 1 })}
										active={menu === index}
										trigger={(grip) => <DropdownMenuTrigger render={grip} />}
									/>
									<DropdownMenuContent>
										{count < MOST && (
											<>
												<DropdownMenuItem onClick={() => block.insertChild(column(), index, { widths: undefined })}>
													{say(words.addLeft)}
												</DropdownMenuItem>
												<DropdownMenuItem onClick={() => block.insertChild(column(), index + 1, { widths: undefined })}>
													{say(words.addRight)}
												</DropdownMenuItem>
											</>
										)}
										{count > FEWEST && (
											<DropdownMenuItem
												variant="danger"
												onClick={() => block.mergeChild(index, index === 0 ? 1 : index - 1, { widths: undefined })}
											>
												{say(words.remove)}
											</DropdownMenuItem>
										)}
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						))}
						{count < MOST && (
							<div className="monti-block-columns-add">
								<TableAddStrip
									label={say(words.addColumn)}
									onClick={() => block.insertChild(column(), count, { widths: undefined })}
								/>
							</div>
						)}
					</div>
				)}
			</div>
		</BlockFrame>
	);
}
