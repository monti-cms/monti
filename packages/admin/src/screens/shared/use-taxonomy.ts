"use client";

import { type Site, useSite } from "@monti-cms/core/site";
import { useQueries } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import { entriesKeys, listEntries } from "../../api/entries";
import { sharedMessages } from "./messages";

/** Name of the record collection. Used for relation field options and adding. */
export type RecordCollection = string;

/** Taxonomy field name -> options of the collection the field points to. */
export type TaxonomyOptions = Readonly<Record<string, readonly TaxonomyOption[]>>;

export interface TaxonomyOption {
	id: string;
	title: string;
	slug: string | null;
}

type ListResponse = { items: { id: string; title: string | null; slug: string | null }[]; total: number };

/** All active (public) records. If over 100, reads the next page too. */
async function loadAll(site: Site, collection: RecordCollection, signal?: AbortSignal): Promise<TaxonomyOption[]> {
	const t = site.createTranslator(sharedMessages);
	const options: TaxonomyOption[] = [];
	for (let page = 1; page < 50; page++) {
		const params = new URLSearchParams({
			collection,
			pageSize: "100",
			page: String(page),
			sortField: "title",
			sortDirection: "asc",
		});
		params.append("status", "published");
		const data = await listEntries<ListResponse>(site, params, signal);
		options.push(
			...data.items.map((item) => ({
				id: item.id,
				title: item.title || item.slug || t("taxonomy.unnamed"),
				slug: item.slug,
			})),
		);
		if (options.length >= data.total || data.items.length === 0) break;
	}
	return options;
}

/**
 * Reads options of a collection's taxonomy fields (tags, categories, etc.) per field name. Used by list filters, bulk actions and row menus.
 * Fields pointing to the same collection are read only once.
 */
export function useTaxonomyOptions(collection: string, enabled = true): TaxonomyOptions {
	const site = useSite();
	const fields = useMemo(() => site.taxonomyFieldsOf(collection), [collection, site.taxonomyFieldsOf]);
	const targets = useMemo(() => [...new Set(fields.map((stored) => stored.to))], [fields]);
	const combine = useCallback(
		(results: { data?: TaxonomyOption[] }[]): TaxonomyOptions =>
			Object.fromEntries(fields.map((stored) => [stored.name, results[targets.indexOf(stored.to)]?.data ?? []])),
		[fields, targets],
	);
	return useQueries({
		queries: targets.map((target) => ({
			// Under the list cache's prefix, so it is refetched together when the list is refetched.
			queryKey: entriesKeys.taxonomy(target),
			queryFn: ({ signal }: { signal: AbortSignal }) => loadAll(site, target, signal),
			enabled,
		})),
		combine,
	});
}
