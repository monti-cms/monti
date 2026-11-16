"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { COLLISION, PLACES, type Place, usePlacementPadding } from "./placement";

/** A box in viewport pixels. */
type Spot = { left: number; top: number; width?: number; height?: number };

/**
 * What a floating thing stands for: an element (the block, the table's cell), or a box the editor measured (the selected words, a point of the
 * pointer, a table's border). A measured box is a function, read again whenever the page scrolls or the window changes, so the thing follows what
 * it stands for; `context` is the element it lies in, which says what scrolls and resizes it.
 */
type Anchor = Element | { spot: () => Spot; context?: Element };

type Virtual = { contextElement: Element | undefined; getBoundingClientRect: () => DOMRect };

const keyOf = ({ left, top, width = 0, height = 0 }: Spot) => `${left},${top},${width},${height}`;

/** The nearest box that scrolls, around `from`. */
function scrollerOf(from: Element | undefined): HTMLElement | null {
	for (let at = from?.parentElement; at; at = at.parentElement)
		if (/(auto|scroll)/.test(getComputedStyle(at).overflowY)) return at;
	return null;
}

/**
 * The box a thing folds into, across only: the body's left and width, read again whenever the body or a box around it changes size and when the window
 * does (a panel opening beside a centred column moves the body without resizing it), and the whole window up and down. A box that limited it up and
 * down too would put a card over the first line on the wrong side of the words, where the window has room.
 */
function useAcrossBoundary(within: Element | null | undefined) {
	const [boundary, setBoundary] = useState<{ x: number; y: number; width: number; height: number } | undefined>();
	useEffect(() => {
		if (!within) {
			setBoundary(undefined);
			return;
		}
		const measure = () => {
			const box = within.getBoundingClientRect();
			const next = { x: box.left, y: 0, width: box.width, height: window.innerHeight };
			setBoundary((was) =>
				was && was.x === next.x && was.width === next.width && was.height === next.height ? was : next,
			);
		};
		measure();
		const watch = new ResizeObserver(measure);
		for (let at: Element | null = within; at && at !== document.body; at = at.parentElement) watch.observe(at);
		window.addEventListener("resize", measure);
		return () => {
			watch.disconnect();
			window.removeEventListener("resize", measure);
		};
	}, [within]);
	return boundary;
}

/**
 * The one way the editor floats something over its text or its margin (overlay.md, the place rule): the block handle, the format card, a table's grips,
 * + strips and borders, the block in hand, the drop line, the picking box. It stands on `anchor` by the named `place` (`placement.ts`) and draws no
 * surface of its own; what it holds does. Base UI's positioner does the measuring, the scrolling along and the meeting of edges, so no part computes
 * a `top` and a `left` itself:
 *
 * - `within` is the box it folds inside, across only (the body's text box; a card over words never leaves it sideways), read live (`useAcrossBoundary`).
 *   Up and down the window is the limit. With none it folds inside the window.
 * - `place="over-box"` is laid exactly over its anchor's box and is as big as it (`--anchor-width`, `--anchor-height`, live): a held line, a table's
 *   right edge, a border, the picking box.
 * - What stands at an edge (a handle, a grip, a strip, a border) is hidden as soon as any part of it would go out of the scrolling box it stands in (under the
 *   editor's header), and never flips onto the text.
 *
 * Its anchor is the same object while the box it measures is the same, so the positioner does not start following again at every keystroke.
 */
function Anchored({
	anchor,
	place,
	within,
	children,
}: {
	anchor: Anchor | null;
	place: Place;
	within?: Element | null;
	children: ReactNode;
}) {
	const padding = usePlacementPadding();
	const boundary = useAcrossBoundary(within);
	const box = useRef<HTMLDivElement | null>(null);
	const [clipped, setClipped] = useState(false);
	const standsAtEdge = PLACES[place].collision === "exact" && place !== "over-box";
	const context = anchor instanceof Element ? anchor : anchor?.context;
	useEffect(() => {
		const scroller = standsAtEdge ? scrollerOf(context) : null;
		if (!scroller) return;
		let frame = 0;
		const check = () => {
			const mine = box.current?.getBoundingClientRect();
			const room = scroller.getBoundingClientRect();
			setClipped(Boolean(mine && mine.height > 0 && (mine.top < room.top - 0.5 || mine.bottom > room.bottom + 0.5)));
		};
		// The positioner follows a scroll a frame later: read after it.
		const soon = () => {
			cancelAnimationFrame(frame);
			frame = requestAnimationFrame(() => requestAnimationFrame(check));
		};
		soon();
		scroller.addEventListener("scroll", soon, { passive: true });
		window.addEventListener("resize", soon);
		return () => {
			cancelAnimationFrame(frame);
			scroller.removeEventListener("scroll", soon);
			window.removeEventListener("resize", soon);
		};
	}, [standsAtEdge, context]);
	const last = useRef<{ key: string; context: Element | undefined; virtual: Virtual } | null>(null);
	if (typeof document === "undefined" || !anchor) return null;
	let target: Element | Virtual;
	if (anchor instanceof Element) target = anchor;
	else {
		const key = keyOf(anchor.spot());
		if (last.current?.key !== key || last.current.context !== anchor.context) {
			const spot = anchor.spot;
			last.current = {
				key,
				context: anchor.context,
				virtual: {
					contextElement: anchor.context,
					getBoundingClientRect: () => {
						const { left, top, width = 0, height = 0 } = spot();
						return new DOMRect(left, top, width, height);
					},
				},
			};
		}
		target = last.current.virtual;
	}
	const where = PLACES[place];
	return (
		<PopoverPrimitive.Root
			open
			modal={false}
			onOpenChange={(_open, details) => {
				// Always open: a press outside or Esc does not close it, and does not stop the key or the press for the page (a picture's resize takes Esc).
				details.cancel();
				details.allowPropagation();
			}}
		>
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Positioner
					data-slot="anchored"
					data-place={place}
					anchor={target}
					side={where.side}
					align={where.align}
					sideOffset={where.sideOffset}
					alignOffset={where.alignOffset ?? 0}
					collisionBoundary={boundary}
					collisionPadding={where.collision === "exact" ? 0 : padding}
					collisionAvoidance={COLLISION[where.collision]}
					className="isolate z-40 data-anchor-hidden:pointer-events-none data-clipped:pointer-events-none data-anchor-hidden:invisible data-clipped:invisible"
					data-clipped={clipped || undefined}
				>
					<div
						ref={box}
						data-slot="anchored-box"
						className={
							place === "over-box" ? "flex h-(--anchor-height) w-(--anchor-width) items-center" : "flex items-center"
						}
					>
						{children}
					</div>
				</PopoverPrimitive.Positioner>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}

export { Anchored, type Anchor, type Spot };
