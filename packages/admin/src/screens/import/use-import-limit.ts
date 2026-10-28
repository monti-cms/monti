"use client";

import { useSite } from "@monti-cms/core/site";
import { useQuery } from "@tanstack/react-query";
import { getImportLimit, importKeys } from "../../api/import";

/** The size the server takes for a zip, and whether `file` is over it (a file that is cannot be read, and is not sent). */
export function useImportLimit(file: File | null) {
	const site = useSite();
	const limitQuery = useQuery({
		queryKey: importKeys.limit(),
		queryFn: ({ signal }) => getImportLimit(site, signal),
		staleTime: 5 * 60_000,
	});
	const limit = limitQuery.data;
	return { limit, tooLarge: file !== null && limit !== undefined && file.size > limit };
}
