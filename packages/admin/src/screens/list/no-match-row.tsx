import { Inline, TableCell, TableRow, Text, TextButton } from "@monti-cms/ui";
import { useAdmin } from "../../operations/admin-context";
import { firstStop, useFocusHandOff } from "../frame/focus-hand-off";

/** What narrows a list now: a search, filters, or both. The button that takes it off is named by it. */
export type NoMatchApplied = { search: boolean; filters: boolean };

/**
 * The one answer a list gives when its search and filters leave nothing, in every list (a table's row and a grid's line alike): what was found
 * (nothing) and a button named by what is applied. Only a search: "Clear search"; only filters: "Clear filters"; both: "Clear all". It takes off
 * what is applied.
 */
export function NoMatchLine({
	words,
	applied,
	onClear,
}: {
	words: string;
	applied: NoMatchApplied;
	onClear: () => void;
}) {
	const { t } = useAdmin();
	const label =
		applied.search && applied.filters ? "list.clearAll" : applied.search ? "list.clearSearch" : "list.clearFilters";
	return (
		<Inline gap={12}>
			<Text tone="subtle">{words}</Text>
			<TextButton onClick={onClear}>{t(label)}</TextButton>
		</Inline>
	);
}

/**
 * The one row of a table whose search and filters leave nothing, in every list: it says so in the list's own words ({@link NoMatchLine}). The column
 * names stay over it, so a filter can also be taken off where it was set.
 *
 * Its button goes with the row once the list has rows again: the keyboard's focus it held goes to the list's first row, not to the page
 * (tokens.md, the states; every list alike).
 */
export function NoMatchRow({
	colSpan,
	words,
	applied,
	onClear,
}: {
	colSpan: number;
	words: string;
	applied: NoMatchApplied;
	onClear: () => void;
}) {
	const handOff = useFocusHandOff((gone) => {
		const table = gone.closest("table");
		// A frame on: the rows that take this one's place are drawn with the answer that takes it away.
		return () =>
			requestAnimationFrame(() => {
				if (document.activeElement !== document.body) return;
				const row = table?.isConnected ? table.querySelector<HTMLElement>("tbody [data-slot=row-link]") : null;
				(row ?? firstStop())?.focus();
			});
	});
	return (
		<TableRow ref={handOff}>
			<TableCell colSpan={colSpan}>
				<NoMatchLine words={words} applied={applied} onClear={onClear} />
			</TableCell>
		</TableRow>
	);
}
