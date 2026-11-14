/**
 * What a filter menu's counts count, said over them (LT-12, MD-07; components/list.md): a pick looks through the folders below the open one,
 * or through every folder at the top and while a search looks everywhere. `null` when there are no folders: the counts are then the rows on
 * the screen, and nothing is said. The list's column menus and the media library's menus say it by this one rule.
 */
export function countedWhere({
	folders,
	open,
	everywhere,
}: {
	/** How many folders the collection or library has (none while folders are off). */
	folders: number;
	/** The open folder, `null` at the top. */
	open: string | null;
	/** A search looks through every folder. */
	everywhere: boolean;
}): "list.countedEverywhere" | "list.countedBelow" | null {
	if (folders === 0) return null;
	return open === null || everywhere ? "list.countedEverywhere" : "list.countedBelow";
}
