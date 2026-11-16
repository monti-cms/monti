"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { type ReactNode, useRef } from "react";
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

/**
 * The one way the editor floats something over its text or its margin (overlay.md, the place rule): the block handle, the format card, a table's grips,
 * + strips and borders, the block in hand, the drop line, the picking box. It stands on `anchor` by the named `place` (`placement.ts`) and draws no
 * surface of its own; what it holds does. Base UI's positioner does the measuring, the scrolling along and the meeting of edges, so no part computes
 * a `top` and a `left` itself:
 *
 * - `within` is the box it folds inside, across (the body's text box; a card over words never leaves it). It is the element itself, which the
 *   positioner measures again whenever it is placed, so it follows the box when a panel opens beside it. With none it folds inside the window.
 * - `place="over-box"` is laid exactly over its anchor's box and is as big as it (`--anchor-width`, `--anchor-height`, live): a held line, a table's
 *   right edge, a border, the picking box.
 * - It is hidden while what it stands for has scrolled out of view (under the editor's header), and never flips onto the text.
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
					collisionBoundary={within ?? undefined}
					collisionPadding={where.collision === "exact" ? 0 : padding}
					collisionAvoidance={COLLISION[where.collision]}
					className="isolate z-40 data-anchor-hidden:pointer-events-none data-anchor-hidden:invisible"
				>
					<div
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
