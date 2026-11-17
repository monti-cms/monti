import { DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@monti-cms/ui";
import { useAdmin } from "../../operations/admin-context";

type Dir = "asc" | "desc";

/**
 * The two rows a sortable column's menu starts with, in every table (components/list.md): one for each way. A column of words or numbers says "ascending" and
 * "descending"; a date says which end comes first, the newest one above. `words` are a column's own, when neither says it (the trash's days left).
 */
export function SortRows({
	kind = "value",
	dir,
	onChange,
	words,
}: {
	kind?: "value" | "date";
	/** The way it is sorted now; `null` when the table is sorted by another column. */
	dir: Dir | null;
	onChange: (dir: Dir) => void;
	words?: Record<Dir, string>;
}) {
	const { t } = useAdmin();
	const said = words ?? {
		asc: t(kind === "date" ? "list.oldest" : "list.sortAsc"),
		desc: t(kind === "date" ? "list.newest" : "list.sortDesc"),
	};
	const order: Dir[] = kind === "date" ? ["desc", "asc"] : ["asc", "desc"];
	return (
		<DropdownMenuRadioGroup value={dir ?? ""} onValueChange={(next) => onChange(next === "desc" ? "desc" : "asc")}>
			{order.map((each) => (
				<DropdownMenuRadioItem key={each} value={each}>
					{said[each]}
				</DropdownMenuRadioItem>
			))}
		</DropdownMenuRadioGroup>
	);
}
