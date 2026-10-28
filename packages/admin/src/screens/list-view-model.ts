import type { ListSortField, Site } from "@monti-cms/core/site";
import { screensMessages } from "./messages";

/** One way to order the list: the field and the direction together, as the view menu lists them. */
export interface SortChoice {
	readonly field: ListSortField;
	readonly direction: "asc" | "desc";
	readonly label: string;
}

/**
 * The orders the view menu offers: the dates, newest first and oldest first, then the title. An item collection is never published, so it has no
 * published date to order by. Which order is on is `field` and `direction` together; there is no separate direction to pick.
 */
export function sortChoicesOf(site: Site, collection: string): SortChoice[] {
	const t = site.createTranslator(screensMessages);
	const dates: ListSortField[] = ["updatedAt", "publishedAt", "createdAt"];
	const published = site.isCollection(collection) && site.isDocumentCollection(collection);
	return [
		...dates
			.filter((field) => field !== "publishedAt" || published)
			.flatMap((field) =>
				(["desc", "asc"] as const).map((direction) => ({
					field,
					direction,
					label: t(`sort.${field}.${direction}` as "sort.updatedAt.desc"),
				})),
			),
		...(["asc", "desc"] as const).map((direction) => ({
			field: "title" as const,
			direction,
			label: t(`sort.title.${direction}`),
		})),
	];
}

/** The name of an order, for the value shown beside "Sort" (the address can carry an order the menu does not list, such as the address). */
export function sortLabel(site: Site, field: ListSortField, direction: "asc" | "desc"): string {
	return site.createTranslator(screensMessages)(`sort.${field}.${direction}` as "sort.updatedAt.desc");
}
