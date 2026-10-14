import { entriesKeys, listEntries } from "../api/entries.js";
import { commonMessages } from "../lib/common.messages.js";
/** Query key of the `[[` link search for typed text. */
export const linkSearchKey = (query) => [...entriesKeys.all, "link-search", query];
/**
 * Finds the entries a `[[` link can point to. Only collections that have a public path are searched. A translation is found through its source.
 * A failed request is thrown as the admin API error ({@link listEntries}) instead of turning into an empty list.
 */
export async function searchLinkTargets(site, query) {
    const tc = site.createTranslator(commonMessages);
    const search = async (collection) => {
        const params = new URLSearchParams({ collection, pageSize: "25" });
        if (query)
            params.set("search", query);
        for (const status of ["draft", "published"])
            params.append("status", status);
        // One result per translation group, the source entry: its id is the id a link stores (a link follows the reader's language).
        params.set("group", "translation");
        const data = await listEntries(site, params);
        return data.items.map((item) => ({
            id: item.id,
            collection: item.collection,
            title: item.title || tc("untitled"),
            slug: item.slug ?? "",
            ...(item.locale ? { locale: item.locale } : {}),
            status: item.status,
        }));
    };
    const results = await Promise.all(site.LINKABLE_COLLECTIONS.map(search));
    return results.flat().slice(0, 20);
}
