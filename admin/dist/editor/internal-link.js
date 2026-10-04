import { contentPath } from "@monti-cms/core/client";
/**
 * Internal post link address. Stored as a plain Markdown link `[title](<path built from the collection path and the address>)`; no fixed ID is stored.
 * The address shape is the collection definition's `path`. No broken link is made for a collection without a path or a missing slug.
 */
export function internalLinkHref(item) {
    return contentPath(item.collection, item.slug);
}
/** MDX storage format. Used by raw-source mode insertion and tests. */
export function formatContentLinkMdx(item, alias) {
    const displayText = alias ? alias.trim() : item.title;
    const href = internalLinkHref(item);
    return href ? `[${displayText}](${href})` : displayText;
}
/**
 * Replaces the `[[query` range with text carrying a link mark. The link text is the title at insertion time and can be freely edited afterward.
 * Inserting the string `[title](address)` as text would be escaped on save and would not become a link.
 */
export function insertInternalLink(editor, range, item) {
    const href = internalLinkHref(item);
    const chain = editor.chain().focus().deleteRange(range);
    if (!href) {
        chain.insertContent(item.title).run();
        return;
    }
    chain
        .insertContent([
        { type: "text", text: item.title, marks: [{ type: "link", attrs: { href } }] },
        { type: "text", text: " " },
    ])
        .run();
}
export function parseInternalLinkTrigger(text) {
    const match = text.match(/\[\[([^\]]*)$/);
    if (!match)
        return { active: false, query: "" };
    return { active: true, query: match[1] };
}
