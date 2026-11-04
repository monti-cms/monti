import { isSpacing, type SpacingStep, type SpecChild } from "./format";

export type Direction = "column" | "row";

/**
 * The classes a design system's pack gives for each spacing step: a container's gap, its padding at the start and the end of its axis, and the margin
 * before a child. Every step of the pack's scale has one of each.
 */
export interface SpacingClassTable {
	readonly gap: Readonly<Record<number, string>>;
	readonly paddingStart: Readonly<Record<Direction, Readonly<Record<number, string>>>>;
	readonly paddingEnd: Readonly<Record<Direction, Readonly<Record<number, string>>>>;
	readonly marginBefore: Readonly<Record<Direction, Readonly<Record<number, string>>>>;
}

/** What a container's `Spacing` items become: classes on the container, and a margin class on some of its children (by their place in `children`). */
export interface SpacingClasses {
	readonly container: readonly string[];
	readonly margins: ReadonlyMap<number, string>;
}

/**
 * Turns a container's `Spacing` items into the pack's token classes, so the app's DOM has no element for empty space and no style of its own. A first or
 * last Spacing is the container's padding on that end of its axis. The ones between children are the container's gap when they are all the same size,
 * and no two children touch, and otherwise a margin on the child after each (a gap and margins together would add up). A child's margin goes with it
 * when it is hidden.
 */
export function spacingClasses(
	children: readonly SpecChild[],
	direction: Direction,
	table: SpacingClassTable,
): SpacingClasses {
	const container: string[] = [];
	const classOf = (classes: Readonly<Record<number, string>>, step: SpacingStep) => {
		const name = classes[step];
		if (name === undefined) throw new Error(`the pack has no class for the spacing step ${step}`);
		return name;
	};
	const first = children[0];
	const last = children[children.length - 1];
	if (first !== undefined && isSpacing(first)) container.push(classOf(table.paddingStart[direction], first.spacing));
	if (last !== undefined && last !== first && isSpacing(last)) {
		container.push(classOf(table.paddingEnd[direction], last.spacing));
	}

	const between = new Map<number, SpacingStep>();
	children.forEach((child, index) => {
		if (index > 0 && index < children.length - 1 && isSpacing(child)) between.set(index + 1, child.spacing);
	});
	const sizes = new Set(between.values());
	// A gap spaces every two neighbours, so it stands for the Spacings only when no two children touch.
	const touching = children.some(
		(child, index) => index > 0 && !isSpacing(child) && !isSpacing(children[index - 1] as SpecChild),
	);
	const margins = new Map<number, string>();
	if (sizes.size === 1 && !touching) container.push(classOf(table.gap, [...sizes][0] as SpacingStep));
	else for (const [index, step] of between) margins.set(index, classOf(table.marginBefore[direction], step));
	return { container, margins };
}
