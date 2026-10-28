"use client";

import { useSite } from "@monti-cms/core/site";
import { useQuery } from "@tanstack/react-query";
import { countListValues, entriesKeys, type ListCountsResponse } from "../api/entries";
import { type ListState, listStateToCountsQuery } from "./list-state";

/**
 * The numbers beside the values of one filter: how many rows of the current folder and status have each value, or none. Asked only while its menu
 * is open (`enabled`), so a menu nobody opens costs nothing. `null` until the first answer; a failed answer leaves the menu without numbers
 * instead of without values.
 */
export function useListCounts(
	state: ListState,
	facet: Parameters<typeof listStateToCountsQuery>[2],
	enabled = true,
): ListCountsResponse | null {
	const site = useSite();
	const query = listStateToCountsQuery(site, state, facet);
	const counts = useQuery({
		queryKey: entriesKeys.counts(query.toString()),
		queryFn: ({ signal }) => countListValues(site, query, signal),
		enabled,
		retry: false,
		// The numbers follow the rows: they are asked again once something was written.
		staleTime: 0,
	});
	return counts.data ?? null;
}
