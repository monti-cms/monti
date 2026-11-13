import { RowActions } from "@monti-cms/ui";
import type { ReactNode } from "react";
import { firstStopIn, useFocusHandOff } from "../frame/focus-hand-off";

/** Where a list begins for the keyboard: its first row, or what a list with no match offers in its place, or its first column's name. */
export const listStartOf = (table: HTMLElement | null) =>
	table?.isConnected
		? (table.querySelector<HTMLElement>("tbody [data-slot=row-link], tbody button") ??
			table.querySelector<HTMLElement>("thead button"))
		: null;

/**
 * Where the keyboard's focus goes when a row leaves its list by its own action (a failed delivery sent again in a list of failed ones, a
 * row of the trash restored or deleted for good): to the row that follows, or with none after it to the list's start, not to the page
 * (tokens.md, the states). What stands after the list (the corner's button, a panel) is not what the row's action was about.
 */
export const afterRow = (listStart: () => HTMLElement | null) => (gone: HTMLElement) => {
	const next = gone.closest("tr")?.nextElementSibling;
	return (next && firstStopIn(next)) || (() => requestAnimationFrame(() => listStart()?.focus()));
};

/**
 * A row's ⋯ in a list whose rows can leave by their own action: the focus it holds when its row goes is handed on ({@link afterRow}). `row`
 * names the row, so a question that outlives the row can ask whether its ⋯ is still there ({@link rowActionsOf}).
 */
export function HandedRowActions({
	row,
	listStart,
	children,
}: {
	row?: string;
	listStart: () => HTMLElement | null;
	children: ReactNode;
}) {
	const handOff = useFocusHandOff(afterRow(listStart));
	return (
		<RowActions ref={handOff} data-row-actions={row}>
			{children}
		</RowActions>
	);
}

/** The ⋯ of the row named `row`, while that row is in the list. */
export const rowActionsOf = (table: HTMLElement | null, row: string) =>
	[...(table?.querySelectorAll<HTMLElement>("[data-row-actions]") ?? [])]
		.find((each) => each.dataset.rowActions === row)
		?.querySelector<HTMLElement>("button") ?? null;
