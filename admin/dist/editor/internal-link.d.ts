import type { Editor, Range } from "@tiptap/core";
export interface InternalLinkItem {
    id: string;
    collection: string;
    title: string;
    slug: string;
    /** State of the target. Links to draft targets are allowed while editing but flagged. */
    status?: string;
}
/**
 * Internal post link address. Stored as a plain Markdown link `[title](<path built from the collection path and the address>)`; no fixed ID is stored.
 * The address shape is the collection definition's `path`. No broken link is made for a collection without a path or a missing slug.
 */
export declare function internalLinkHref(item: InternalLinkItem): string | null;
/** MDX storage format. Used by raw-source mode insertion and tests. */
export declare function formatContentLinkMdx(item: InternalLinkItem, alias?: string): string;
/**
 * Replaces the `[[query` range with text carrying a link mark. The link text is the title at insertion time and can be freely edited afterward.
 * Inserting the string `[title](address)` as text would be escaped on save and would not become a link.
 */
export declare function insertInternalLink(editor: Editor, range: Range, item: InternalLinkItem): void;
export declare function parseInternalLinkTrigger(text: string): {
    active: boolean;
    query: string;
};
