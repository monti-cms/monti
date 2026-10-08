import { rememberLinkTarget } from "./link-targets.js";
/**
 * The address an internal link shows in the editor, built from the collection's `path` and the slug. It is display only: the link is stored as the id of
 * the entry, so a later rename of the slug changes nothing in the body. `null` for a collection without a path, which cannot be linked to.
 */
export function internalLinkHref(site, item) {
    const path = site.contentPath(item.collection, item.slug);
    return path ? site.localizePath(item.locale ?? site.DEFAULT_LOCALE, path) : null;
}
/**
 * Replaces the `[[query` range with text carrying a link mark that points to the entry (`entryId`, with the address to show as `href`, which is dropped
 * on save). The link text is the title at insertion time and can be freely edited afterward. `item.id` is the id of the source entry (the translation
 * group), so the link follows the reader's language.
 * A collection without a public path cannot be linked to; the title is inserted as plain text.
 */
export function insertInternalLink(site, editor, range, item) {
    const href = internalLinkHref(site, item);
    const chain = editor.chain().focus().deleteRange(range);
    if (!href) {
        chain.insertContent(item.title).run();
        return;
    }
    // The link bubble shows where the link goes; the entry is known now, so it does not have to be looked up.
    rememberLinkTarget(site, item);
    chain
        .insertContent([
        { type: "text", text: item.title, marks: [{ type: "link", attrs: { entryId: item.id, href } }] },
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
