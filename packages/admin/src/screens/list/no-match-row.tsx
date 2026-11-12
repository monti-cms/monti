import { Inline, TableCell, TableRow, Text, TextButton } from "@monti-cms/ui";
import { useAdmin } from "../../operations/admin-context";

/**
 * The one row of a table whose search and filters leave nothing, in every list: it says so in the list's own words, and its button takes the search
 * and the filters off. The column names stay over it, so a filter can also be taken off where it was set.
 */
export function NoMatchRow({ colSpan, words, onClear }: { colSpan: number; words: string; onClear: () => void }) {
	const { t } = useAdmin();
	return (
		<TableRow>
			<TableCell colSpan={colSpan}>
				<Inline gap={12}>
					<Text tone="subtle">{words}</Text>
					<TextButton onClick={onClear}>{t("list.clearFilters")}</TextButton>
				</Inline>
			</TableCell>
		</TableRow>
	);
}
