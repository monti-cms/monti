"use client";

import { useSite } from "@monti-cms/core/site";
import { useQueries } from "@tanstack/react-query";
import { entriesKeys, searchEntries } from "../api/entries";
import { filterFieldOf } from "./list-filter-fields";
import type { ListState } from "./list-state";

/**
 * The titles of the items a relation filter holds, by id, for the chips ("Tag: React"). Only the server knows them, so each field's items are looked up
 * once by id (`entries/search?id=`) and kept; until the answer an id has no title, and the chip says "…".
 */
export function useFilterTitles(state: ListState): ReadonlyMap<string, string> {
	const site = useSite();
	const lookups = Object.entries(state.fields).flatMap(([name, conditions]) => {
		const field = filterFieldOf(site, state.collection, name);
		const ids = conditions.flatMap((condition) => (condition.kind === "is" ? [condition.value] : []));
		return field?.kind === "relation" && field.to && ids.length > 0 ? [{ collection: field.to, ids }] : [];
	});
	const answers = useQueries({
		queries: lookups.map(({ collection, ids }) => {
			const query = new URLSearchParams({ collection });
			for (const id of ids) query.append("id", id);
			return {
				queryKey: entriesKeys.search(`titles:${query.toString()}`),
				queryFn: ({ signal }: { signal: AbortSignal }) => searchEntries(site, query, signal),
				retry: false,
				staleTime: 60_000,
			};
		}),
	});
	const titles = new Map<string, string>();
	for (const answer of answers)
		for (const item of answer.data?.items ?? []) if (item.title) titles.set(item.id, item.title);
	return titles;
}
