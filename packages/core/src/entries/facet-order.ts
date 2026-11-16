// A module of its own with no imports: the admin's client code sorts with it too, and the list's module reads the database (a client bundle
// cannot hold that).

/**
 * The order of the values that come from the content (select options, relations, languages, the trash's kinds), one rule for every menu
 * (components/list.md): the values with the most rows first, the ones with the same count by the name shown on screen (`label`, else the value), and
 * the values with no rows kept, at the end. A fixed set the system defines (entry status, delivery states, translation state) keeps its own order.
 * A client that shows a value under another name than the one it came with (a language's) sorts with this too, by that name.
 */
export function sortFacets<T extends { value: string | null; label?: string; count: number }>(
	facets: readonly T[],
): T[] {
	const name = (facet: T) => facet.label ?? facet.value ?? "";
	return [...facets].sort((a, b) => b.count - a.count || name(a).localeCompare(name(b)));
}
