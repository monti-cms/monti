/** Address value that keeps an item open in the list screen (`?collection=tag&open=<ID>`). Item collections open in a small form in the list instead of an edit screen. */
export declare const OPEN_ITEM_PARAM = "open";
/**
 * Admin address that opens one piece of content. Document collections go to the edit screen; item collections (`kind: "item"`) go to the address that opens the item slot in their list.
 * Used by places that point to items of several collections, like media usages.
 */
export declare function entryHref(collection: string | null | undefined, id: string): string;
