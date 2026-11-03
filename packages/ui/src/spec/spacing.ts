import {
	GAP,
	MARGIN_LEFT,
	MARGIN_TOP,
	PADDING_BOTTOM,
	PADDING_LEFT,
	PADDING_RIGHT,
	PADDING_TOP,
} from "../tokens.generated";
import { isSpacing, type SpacingStep, type SpecChild } from "./format";

export type Direction = "column" | "row";

/** What a container's `Spacing` items become: classes on the container, and a margin class on some of its children (by their place in `children`). */
export interface SpacingClasses {
	readonly container: readonly string[];
	readonly margins: ReadonlyMap<number, string>;
}

const PADDING_START = { column: PADDING_TOP, row: PADDING_LEFT } as const;
const PADDING_END = { column: PADDING_BOTTOM, row: PADDING_RIGHT } as const;
const MARGIN_BEFORE = { column: MARGIN_TOP, row: MARGIN_LEFT } as const;

/**
 * Turns a container's `Spacing` items into token classes, so the app's DOM has no element for empty space and no style of its own. A first or last Spacing
 * is the container's padding on that end of its axis. The ones between children are the container's gap when they are all the same size, and otherwise
 * a margin on the child after each (a gap and margins together would add up). A child's margin goes with it when it is hidden.
 */
export function spacingClasses(children: readonly SpecChild[], direction: Direction): SpacingClasses {
	const container: string[] = [];
	const first = children[0];
	const last = children[children.length - 1];
	if (first !== undefined && isSpacing(first)) container.push(PADDING_START[direction][first.spacing]);
	if (last !== undefined && last !== first && isSpacing(last)) container.push(PADDING_END[direction][last.spacing]);

	const between = new Map<number, SpacingStep>();
	children.forEach((child, index) => {
		if (index > 0 && index < children.length - 1 && isSpacing(child)) between.set(index + 1, child.spacing);
	});
	const sizes = new Set(between.values());
	const margins = new Map<number, string>();
	if (sizes.size === 1) container.push(GAP[[...sizes][0] as SpacingStep]);
	else for (const [index, step] of between) margins.set(index, MARGIN_BEFORE[direction][step]);
	return { container, margins };
}
