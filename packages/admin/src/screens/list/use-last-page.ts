import { useEffect } from "react";

/**
 * A page past the last one (the list shrank, or an old address) is not an answer of its own: it goes to the last page, in every list. Nothing found
 * under a search or filters is another thing (`NoMatchRow`), and so is a list with nothing in it (`Empty`); this is only for a page the rows
 * do not reach (components/list.md, the no-match answer).
 */
export function useLastPage({
	none,
	page,
	total,
	pageSize,
	go,
}: {
	/** Whether this page's rows are none: rows still there are the answer to some page, so the page is not asked about. */
	none: boolean;
	page: number;
	total: number;
	pageSize: number;
	go: (page: number) => void;
}) {
	const last = Math.max(1, Math.ceil(total / pageSize));
	useEffect(() => {
		if (none && total > 0 && page > last) go(last);
	}, [none, total, page, last, go]);
}
