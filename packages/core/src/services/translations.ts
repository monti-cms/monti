import type { Cms } from "../cms";

/** The translation group of an entry (the languages the editor shows as existing). Empty for an item collection, which has no translations. */
export async function translationsOf(cms: Cms, entry: { readonly id: string; readonly collection: string }) {
	if (cms.site.isItemCollection(entry.collection)) return [];
	return (await cms.store().getTranslationGroup({ entryId: entry.id })).members;
}
