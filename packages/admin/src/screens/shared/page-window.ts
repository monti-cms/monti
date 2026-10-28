/** How many buttons the run holds once the pages do not all fit: the first, a gap, three around the current page, a gap, the last. */
const SLOTS = 7;

/**
 * The page buttons between "Previous" and "Next". Up to seven pages are all shown. Beyond that the run is always seven buttons wide, so it does not
 * change width as the page changes: the first page, the current one with its neighbours and the last, with a gap for the pages left out; near an end the
 * five pages at that end.
 */
export function pageWindow(page: number, totalPages: number): (number | "gap")[] {
	const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);
	if (totalPages <= SLOTS) return range(1, totalPages);
	if (page <= 4) return [...range(1, 5), "gap", totalPages];
	if (page >= totalPages - 3) return [1, "gap", ...range(totalPages - 4, totalPages)];
	return [1, "gap", page - 1, page, page + 1, "gap", totalPages];
}
