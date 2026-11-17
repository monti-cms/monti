"use client";

import {
	Anchored,
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
import { ArrowsHorizontal } from "@monti-cms/admin/icons";
import { type CSSProperties, useEffect, useLayoutEffect, useRef, useState } from "react";
import { columnsGridTemplate, parseColumnWidths } from "./layout";
import { style } from "./style";
import { words } from "./words";

/** Two columns at least; four at most: the old block's, and at the body's 680px no column is narrower than 160px. */
const FEWEST = 2;
const MOST = 4;
/** No column is narrower than this share (%) when a border is dragged; the arrow keys move a border this much. */
const NARROWEST = 10;
const STEP = 5;
/** The hit area over a border (px), and the + strip as the table's: 4px outside the frame's right edge and 16px thick. */
const BORDER = 9;
const STRIP_GAP = 4;
const STRIP = 16;

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
	const strip = useRef<HTMLButtonElement>(null);
	// Counts the drawings, so the tools that stand on the columns are asked again once they are there.
	const [, setMade] = useState(0);
	/** The pointer is over the block: its + strip shows. */
	const [over, setOver] = useState(false);
	const [menu, setMenu] = useState<number | null>(null);
	/** The column the pointer is over: its grip shows, as the cursor's column's does. */
	const [pointed, setPointed] = useState<number | null>(null);
	const hold = useBarHold();

	// The columns as they stand now: the grips stand on them and the borders between them, read again whenever they are placed.
	const columnsOf = () =>
		[...(grid.current?.querySelectorAll<HTMLElement>(".node-column") ?? [])].filter(
			(each) => each.parentElement?.closest(".monti-block-columns-editor") === grid.current,
		);
	// Drawn again once the columns are: their elements are what the tools stand on.
	useLayoutEffect(() => setMade(count));
	const columns = columnsOf();
	const borderAt = (border: number) => () => {
		const cols = columnsOf();
		const frame = grid.current?.getBoundingClientRect();
		const left = cols[border]?.getBoundingClientRect().right ?? 0;
		const right = cols[border + 1]?.getBoundingClientRect().left ?? left;
		return { left: (left + right) / 2 - BORDER / 2, top: frame?.top ?? 0, width: BORDER, height: frame?.height ?? 0 };
	};
	// Outside the frame's right edge, as the table's + strip is.
	const stripAt = () => {
		const frame = grid.current?.getBoundingClientRect();
		return { left: (frame?.right ?? 0) + STRIP_GAP, top: frame?.top ?? 0, width: STRIP, height: frame?.height ?? 0 };
	};

	// The + strip floats away from the block (a layer at the end of the page), so the keyboard would reach it only after the whole page. It is given its
	// place in the block's tab order here: after the block's own stops, and back from it.
	const frame = () => grid.current?.closest("[data-slot=block-frame]") ?? null;
	const barStops = () => [
		...(frame()?.querySelectorAll<HTMLElement>("[data-slot=block-bar-place] button:not([disabled])") ?? []),
	];
	/** The editor's own text element, which holds the focus while a caret is in the body. */
	const root = () => grid.current?.closest<HTMLElement>(".ProseMirror") ?? null;
	/** The caret into the text at `edge` of `from`, the focus on the editor. */
	const caretAt = (from: Element, edge: "start" | "end") => {
		const walker = document.createTreeWalker(from, NodeFilter.SHOW_TEXT);
		let text: Node | null = walker.nextNode();
		for (let next = text; edge === "end" && next; next = walker.nextNode()) text = next;
		root()?.focus();
		const selection = window.getSelection();
		if (text) selection?.collapse(text, edge === "start" ? 0 : (text.textContent?.length ?? 0));
		else selection?.collapse(from, 0);
	};
	/** From the strip on: just after the columns block at its depth (the text that follows, or what follows picked whole), else the next stop after the editor. */
	const afterBlock = () => {
		if (block.moveAfter()) return;
		const editor = root();
		if (!editor) return;
		const stops = [
			...document.querySelectorAll<HTMLElement>("a[href], button:not([disabled]), input, select, textarea, [tabindex]"),
		].filter(
			(each) =>
				each.tabIndex >= 0 &&
				each !== strip.current &&
				!editor.contains(each) &&
				editor.compareDocumentPosition(each) & Node.DOCUMENT_POSITION_FOLLOWING,
		);
		stops[0]?.focus();
	};
	/** Back from the strip: the tool row's last button, else the caret at the end of the block's last text. */
	const beforeStrip = () => {
		const stops = barStops();
		if (stops.length > 0) return stops.at(-1)?.focus();
		if (grid.current) caretAt(grid.current, "end");
	};
	// biome-ignore lint/correctness/useExhaustiveDependencies: the helpers read the refs when the key is pressed
	useEffect(() => {
		// After the editor's own keys (the listener is on the window, the editor's on its text): a key the editor handled (Tab in a table's cell, in a
		// list, in code) has been prevented, and is left to it.
		const onKey = (event: KeyboardEvent) => {
			if (event.key !== "Tab" || event.shiftKey || event.isComposing || event.defaultPrevented || !strip.current)
				return;
			const target = event.target as Element;
			const stops = barStops();
			const toStrip = frame()?.querySelector("[data-slot=block-bar-place]")?.contains(target)
				? target === stops.at(-1)
				: block.inside && target.matches(".ProseMirror") && stops.length === 0;
			if (!toStrip) return;
			event.preventDefault();
			strip.current.focus();
		};
		window.addEventListener("keydown", onKey);
		return () => window.removeEventListener("keydown", onKey);
	}, [block.inside]);

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
	const newColumn = () => ({ type: "column", children: [{ type: "paragraph" }] });

	return (
		<BlockFrame
			// The grips stand on the columns' top edge: the tool row stands above them, so the two never meet.
			lane
			// While a border is dragged, the widths it makes ("60 : 40"), as a picture says its size.
			measure={dragging ? dragging.map((width) => Math.round(width)).join(" : ") : undefined}
			bar={
				saved ? (
					<BlockBar label={say(words.tools)}>
						<BlockBarButton label={say(words.even)} named onClick={() => write(null)}>
							<ArrowsHorizontal aria-hidden />
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
				onPointerMove={(event) => {
					const at = columnsOf().findIndex((each) => {
						const box = each.getBoundingClientRect();
						return event.clientX >= box.left && event.clientX <= box.right;
					});
					setPointed(at < 0 ? null : at);
					setOver(true);
				}}
				onPointerLeave={() => {
					setPointed(null);
					setOver(false);
				}}
				className="monti-block-columns monti-block-columns-editor"
				style={{ "--monti-columns": columnsGridTemplate(widths, count) } as CSSProperties}
			>
				<BlockContent className="monti-block-columns-content" />
				{block.editable && (
					<>
						{columns.slice(0, -1).map((_, border) => (
							<Anchored
								// biome-ignore lint/suspicious/noArrayIndexKey: a border is its place between two columns
								key={border}
								anchor={{ spot: borderAt(border), context: grid.current ?? undefined }}
								place="over-box"
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
							</Anchored>
						))}
						{columns.map((column, index) =>
							menu === index || block.childAt === index || pointed === index ? (
								<Anchored
									// biome-ignore lint/suspicious/noArrayIndexKey: a grip is its column's place
									key={index}
									anchor={column}
									place="table-above"
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
													<DropdownMenuItem
														onClick={() => block.insertChild(newColumn(), index, { widths: undefined })}
													>
														{say(words.addLeft)}
													</DropdownMenuItem>
													<DropdownMenuItem
														onClick={() => block.insertChild(newColumn(), index + 1, { widths: undefined })}
													>
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
								</Anchored>
							) : null,
						)}
						{count < MOST && (
							<Anchored anchor={{ spot: stripAt, context: grid.current ?? undefined }} place="over-box">
								<TableAddStrip
									ref={strip}
									label={say(words.addColumn)}
									shown={over}
									onKeyDown={(event) => {
										if (event.key !== "Tab") return;
										event.preventDefault();
										if (event.shiftKey) beforeStrip();
										else afterBlock();
									}}
									onClick={() => block.insertChild(newColumn(), count, { widths: undefined })}
								/>
							</Anchored>
						)}
					</>
				)}
			</div>
		</BlockFrame>
	);
}
