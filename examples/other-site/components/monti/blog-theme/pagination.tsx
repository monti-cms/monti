import Link from "next/link";

/** Newer and older links of a paged list. The links are relative (`?page=2`), so they keep the path and the language of the page. */
export function Pagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
	const hasOlder = page * pageSize < total;
	if (page <= 1 && !hasOlder) return null;
	const link = "underline underline-offset-4 hover:text-neutral-600 dark:hover:text-neutral-300";
	return (
		<nav aria-label="Pagination" className="mt-10 flex items-center justify-between text-sm">
			{page > 1 ? (
				<Link href={page === 2 ? "?" : `?page=${page - 1}`} className={link} rel="prev">
					Newer posts
				</Link>
			) : (
				<span />
			)}
			<span className="text-neutral-600 dark:text-neutral-400">Page {page}</span>
			{hasOlder ? (
				<Link href={`?page=${page + 1}`} className={link} rel="next">
					Older posts
				</Link>
			) : (
				<span />
			)}
		</nav>
	);
}
