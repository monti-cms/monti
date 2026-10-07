import type { Site } from "@monti-cms/core/client";

/** Address value that keeps an item open in the list screen (`?collection=tag&open=<ID>`). Item collections open in a small form in the list instead of an edit screen. */
export const OPEN_ITEM_PARAM = "open";

/**
 * Admin address that opens one piece of content. Document collections go to the edit screen; item collections (`kind: "item"`) go to the address that opens the item slot in their list.
 * Used by places that point to items of several collections, like media usages.
 */
export function entryHref(site: Site, collection: string | null | undefined, id: string): string {
	if (collection && site.isItemCollection(collection)) {
		return site.adminHref(`?${new URLSearchParams({ collection, [OPEN_ITEM_PARAM]: id }).toString()}`);
	}
	return site.adminEntryEditHref(id);
}
