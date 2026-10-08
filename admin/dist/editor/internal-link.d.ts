import type { Site } from "@monti-cms/core/client";
import type { Editor, Range } from "@tiptap/core";
export interface InternalLinkItem {
    /** The id of the source entry (its translation group id). */
    id: string;
    collection: string;
    title: string;
    slug: string;
    /** Language of the entry, which gives its address the locale prefix. */
    locale?: string;
    /** State of the target. Links to draft targets are allowed while editing but flagged. */
    status?: string;
}
/**
 * The address an internal link shows in the editor, built from the collection's `path` and the slug. It is display only: the link is stored as the id of
 * the entry, so a later rename of the slug changes nothing in the body. `null` for a collection without a path, which cannot be linked to.
 */
export declare function internalLinkHref(site: Site, item: InternalLinkItem): string | null;
/**
 * Replaces the `[[query` range with text carrying a link mark that points to the entry (`entryId`, with the address to show as `href`, which is dropped
 * on save). The link text is the title at insertion time and can be freely edited afterward. `item.id` is the id of the source entry (the translation
 * group), so the link follows the reader's language.
 * A collection without a public path cannot be linked to; the title is inserted as plain text.
 */
export declare function insertInternalLink(site: Site, editor: Editor, range: Range, item: InternalLinkItem): void;
export declare function parseInternalLinkTrigger(text: string): {
    active: boolean;
    query: string;
};
