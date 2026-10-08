import { mapLinkAttrs } from "../doc/entry-links.js";
export const linkAddressKey = (site, address) => `${address.collection}:${address.locale ?? site.DEFAULT_LOCALE}:${address.slug}`;
/** The distinct addresses of the links of a document that point into this site's content, in document order. */
export const internalLinkAddresses = (site, content) => {
    const found = new Map();
    mapLinkAttrs(content, (attrs) => {
        const target = typeof attrs.href === "string" ? site.parseInternalLink(attrs.href) : null;
        if (target)
            found.set(linkAddressKey(site, target), {
                collection: target.collection,
                slug: target.slug,
                ...(target.locale ? { locale: target.locale } : {}),
            });
        return undefined;
    });
    return [...found.values()];
};
/**
 * The document with every internal link whose address is in `entryIds` turned into a link by id. A link whose address is not there stays as it
 * is (publishing reports it as `unresolved_internal_link`). Returns the same document when nothing changed.
 */
export const withEntryLinks = (site, doc, entryIds) => {
    const content = mapLinkAttrs(doc.content, (attrs) => {
        const target = typeof attrs.href === "string" ? site.parseInternalLink(attrs.href) : null;
        const entryId = target ? entryIds.get(linkAddressKey(site, target)) : undefined;
        return entryId ? { entryId } : undefined;
    });
    return content === doc.content ? doc : { ...doc, content: content };
};
