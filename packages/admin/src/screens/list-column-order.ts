import type { AdminListColumn } from "./list-columns";

/** The order after `from` takes the place of `to`: the columns between shift by one toward where `from` was. */
export function placeColumn(
	order: readonly AdminListColumn[],
	from: AdminListColumn,
	to: AdminListColumn,
): AdminListColumn[] {
	const target = order.indexOf(to);
	if (target < 0 || from === to || !order.includes(from)) return [...order];
	const next = order.filter((column) => column !== from);
	next.splice(target, 0, from);
	return next;
}

/**
 * The order after `column` moves one place left (`-1`) or right (`1`) among the columns shown: it swaps with the next shown column on that side, so a
 * hidden column in between does not swallow the step.
 */
export function stepColumn(
	order: readonly AdminListColumn[],
	shown: readonly AdminListColumn[],
	column: AdminListColumn,
	direction: -1 | 1,
): AdminListColumn[] {
	const neighbour = shown[shown.indexOf(column) + direction];
	if (!shown.includes(column) || neighbour === undefined) return [...order];
	const next = [...order];
	const [a, b] = [next.indexOf(column), next.indexOf(neighbour)];
	[next[a], next[b]] = [neighbour, column];
	return next;
}

/**
 * The columns to draw, in order: the ones turned on, less those the width cannot hold. When the columns at their widths and the title at its least do not
 * fit, the columns in `hideFirst` are left out in that order until they do. The title is always drawn.
 */
export function shownColumns({
	order,
	visible,
	width,
	sizeOf,
	titleMin,
	hideFirst,
}: {
	order: readonly AdminListColumn[];
	visible: (column: AdminListColumn) => boolean;
	/** The room the table has, in px; 0 before it is measured (nothing is left out then). */
	width: number;
	sizeOf: (column: AdminListColumn) => number;
	titleMin: number;
	hideFirst: readonly AdminListColumn[];
}): AdminListColumn[] {
	const shown = order.filter((column) => column === "title" || visible(column));
	if (width <= 0) return shown;
	const need = (columns: readonly AdminListColumn[]) =>
		columns.reduce((sum, column) => sum + (column === "title" ? titleMin : sizeOf(column)), 0);
	let kept = shown;
	for (const column of hideFirst) {
		if (need(kept) <= width) break;
		kept = kept.filter((candidate) => candidate !== column);
	}
	return kept;
}
