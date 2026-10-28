/**
 * The page buttons between "Previous" and "Next": the first page, the current one with its neighbours and the last, with a gap where pages are left
 * out. A gap that would hide a single page shows that page. Near an end it shows three pages, so the run does not jump as the page changes.
 */
export function pageWindow(page: number, totalPages: number): (number | "gap")[] {
	const shown = new Set<number>([1, totalPages, page - 1, page, page + 1]);
	if (page <= 2) for (const near of [1, 2, 3]) shown.add(near);
	if (page >= totalPages - 1) for (const near of [totalPages - 2, totalPages - 1, totalPages]) shown.add(near);
	const pages = [...shown].filter((value) => value >= 1 && value <= totalPages).sort((a, b) => a - b);
	const run: (number | "gap")[] = [];
	for (const [index, value] of pages.entries()) {
		const before = pages[index - 1];
		if (before !== undefined && value - before === 2) run.push(before + 1);
		else if (before !== undefined && value - before > 2) run.push("gap");
		run.push(value);
	}
	return run;
}
