import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from "@monti-cms/ui";

/** Seven places at most: every page when they fit, else the first, the last, the pages around this one and "…" for the gaps. */
export function pageRun(page: number, pages: number): (number | "gap")[] {
	if (pages <= 7) return Array.from({ length: pages }, (_, index) => index + 1);
	if (page <= 4) return [1, 2, 3, 4, 5, "gap", pages];
	if (page >= pages - 3) return [1, "gap", pages - 4, pages - 3, pages - 2, pages - 1, pages];
	return [1, "gap", page - 1, page, page + 1, "gap", pages];
}

/** The list's pages under the table: links, so a page has its own address. One page has no pagination (screens/list.md, the row under the table). */
export function ListPages({ page, pages, hrefOf }: { page: number; pages: number; hrefOf: (page: number) => string }) {
	if (pages <= 1) return null;
	return (
		<Pagination>
			<PaginationContent>
				<PaginationItem>
					<PaginationPrevious href={page > 1 ? hrefOf(page - 1) : undefined} disabled={page <= 1} />
				</PaginationItem>
				{pageRun(page, pages).map((place, index) => (
					// A gap has no page of its own; its place in the run names it.
					<PaginationItem key={place === "gap" ? `gap-${index}` : place}>
						{place === "gap" ? (
							<PaginationEllipsis />
						) : (
							<PaginationLink href={hrefOf(place)} isActive={place === page}>
								{place}
							</PaginationLink>
						)}
					</PaginationItem>
				))}
				<PaginationItem>
					<PaginationNext href={page < pages ? hrefOf(page + 1) : undefined} disabled={page >= pages} />
				</PaginationItem>
			</PaginationContent>
		</Pagination>
	);
}
