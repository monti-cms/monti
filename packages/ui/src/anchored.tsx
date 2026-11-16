"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import type { ReactNode } from "react";
import { COLLISION, PLACES, type Place, usePlacementPadding } from "./placement";

/** A box in viewport pixels. */
type Spot = { left: number; top: number; width?: number; height?: number };

/**
 * What a floating thing stands for: an element (the block, the table's cell), or a box the editor measured (the selected words, a point of the
 * pointer, a table's border). A measured box is a function, read again whenever the page scrolls or the window changes, so the thing follows what
 * it stands for; `context` is the element it lies in, which says what scrolls it.
 */
type Anchor = Element | { spot: () => Spot; context?: Element };

/**
 * The one way the editor floats something over its text or its margin (overlay.md, the place rule): the block handle, the format card, a table's grips,
 * + strips and borders, the block in hand, the drop line, the picking box. It stands on `anchor` by the named `place` (`placement.ts`) and draws no
 * surface of its own; what it holds does. Base UI's positioner does the measuring, the scrolling along and the meeting of edges, so no part computes
 * a `top` and a `left` itself:
 *
 * - `within` is the box it folds inside, across (the body's text box; a card over words never leaves it). With none it folds inside the window. Down
 *   and up the window is the limit either way, and the bottom keeps the review bar's room (`usePlacementPadding`).
 * - `size` is as big as what it stands for (a held line's width, a table's right edge), for a thing that is laid over a box (`place="over-box"`).
 */
function Anchored({
	anchor,
	place,
	within,
	size,
	children,
}: {
	anchor: Anchor | null;
	place: Place;
	within?: Element | null;
	size?: { width?: number; height?: number };
	children: ReactNode;
}) {
	const padding = usePlacementPadding();
	if (typeof document === "undefined" || !anchor) return null;
	const where = PLACES[place];
	const virtual =
		anchor instanceof Element
			? anchor
			: {
					contextElement: anchor.context,
					getBoundingClientRect: () => {
						const { left, top, width = 0, height = 0 } = anchor.spot();
						return new DOMRect(left, top, width, height);
					},
				};
	// Across the body's text box, up and down the window: a card over the first line of the text stands in the title's room above it, not below the words.
	const boundary = within
		? (() => {
				const box = within.getBoundingClientRect();
				return { x: box.left, y: 0, width: box.width, height: window.innerHeight };
			})()
		: undefined;
	return (
		<PopoverPrimitive.Root open modal={false} onOpenChange={(_open, details) => details.cancel()}>
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Positioner
					data-slot="anchored"
					data-place={place}
					anchor={virtual}
					side={where.side}
					align={where.align}
					sideOffset={where.sideOffset}
					alignOffset={where.alignOffset ?? 0}
					collisionBoundary={boundary}
					collisionPadding={where.collision === "exact" ? 0 : padding}
					collisionAvoidance={COLLISION[where.collision]}
					className="isolate z-40"
				>
					<div
						data-slot="anchored-box"
						className="flex items-center"
						// design-allow: as big as the box it stands for, measured in the editor
						style={size}
					>
						{children}
					</div>
				</PopoverPrimitive.Positioner>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}

export { Anchored, type Anchor, type Spot };
