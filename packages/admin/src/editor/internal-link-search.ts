import { cmsApiUrl, createTranslator, LINKABLE_COLLECTIONS } from "@monti-cms/core/client";
import { cmsFetch } from "../screens/admin-api";
import type { InternalLinkItem } from "./internal-link";
import { editorMessages } from "./messages";

const t = createTranslator(editorMessages);

type EntryListItem = { id: string; collection: string; title: string | null; slug: string | null; status: string };

/**
 * Finds the entries a `[[` link can point to. Only collections that have a public path are searched.
 * A failed request is thrown as the admin API error ({@link cmsFetch}) instead of turning into an empty list.
 */
export async function searchLinkTargets(query: string): Promise<InternalLinkItem[]> {
	const search = async (collection: string) => {
		const params = new URLSearchParams({ collection, pageSize: "25" });
		if (query) params.set("search", query);
		for (const status of ["draft", "published"]) params.append("status", status);
		const data = await cmsFetch<{ items: EntryListItem[] }>(cmsApiUrl(`/v1/entries?${params.toString()}`));
		return data.items.map((item) => ({
			id: item.id,
			collection: item.collection,
			title: item.title || t("toolbar.untitled"),
			slug: item.slug ?? "",
			status: item.status,
		}));
	};
	const results = await Promise.all(LINKABLE_COLLECTIONS.map(search));
	return results.flat().slice(0, 20);
}
