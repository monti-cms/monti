import { Inline, TableCell, TableRow, Text, TextButton } from "@monti-cms/ui";
import { useAdmin } from "../../operations/admin-context";
import { firstStop, useFocusHandOff } from "../frame/focus-hand-off";

/**
 * The one row of a table whose search and filters leave nothing, in every list: it says so in the list's own words, and its button takes the search
 * and the filters off. The column names stay over it, so a filter can also be taken off where it was set.
 *
 * Its button goes with the row once the list has rows again: the keyboard's focus it held goes to the list's first row, not to the page
 * (tokens.md, the states; every list alike).
 */
export function NoMatchRow({ colSpan, words, onClear }: { colSpan: number; words: string; onClear: () => void }) {
	const { t } = useAdmin();
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
				<Inline gap={12}>
					<Text tone="subtle">{words}</Text>
					<TextButton onClick={onClear}>{t("list.clearFilters")}</TextButton>
				</Inline>
			</TableCell>
		</TableRow>
	);
}
