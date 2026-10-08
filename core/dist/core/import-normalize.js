import { internalLinkAddresses, withEntryLinks } from "./link-ids.js";
const isImageWithSrc = (node) => node.type === "image" &&
    typeof node.attrs?.src === "string" &&
    node.attrs.src !== "" &&
    !(typeof node.attrs.mediaId === "string" && node.attrs.mediaId !== "");
/** The distinct `src` values of the images of `nodes` that are not registered media yet, in document order. */
export const unregisteredImageSources = (nodes) => {
    const found = new Set();
    const visit = (list) => {
        for (const node of list) {
            if (isImageWithSrc(node))
                found.add(node.attrs.src);
            if (node.content)
                visit(node.content);
        }
    };
    visit(nodes);
    return [...found];
};
const withMediaIds = (nodes, mediaIds) => {
    let changed = false;
    const out = nodes.map((node) => {
        let next = node;
        if (isImageWithSrc(node)) {
            const mediaId = mediaIds.get(node.attrs.src);
            if (mediaId) {
                const { src: _src, ...attrs } = node.attrs;
                // Keys stay sorted, as in every stored document.
                next = {
                    ...node,
                    attrs: Object.fromEntries(Object.entries({ ...attrs, mediaId }).sort(([a], [b]) => (a < b ? -1 : 1))),
                };
            }
        }
        if (node.content) {
            const content = withMediaIds(node.content, mediaIds);
            if (content !== node.content)
                next = { ...next, content: content };
        }
        if (next !== node)
            changed = true;
        return next;
    });
    return changed ? out : nodes;
};
/** The document with its internal links and registered media turned into ids. It is the same document when nothing changed. */
export async function normalizeImportedDoc(site, doc, normalizers) {
    let next = doc;
    if (normalizers.links) {
        const addresses = internalLinkAddresses(site, next.content);
        if (addresses.length > 0)
            next = withEntryLinks(site, next, await normalizers.links(addresses));
    }
    if (normalizers.media) {
        const sources = unregisteredImageSources(next.content);
        if (sources.length > 0) {
            const mediaIds = await normalizers.media(sources);
            if (mediaIds.size > 0) {
                const content = withMediaIds(next.content, mediaIds);
                if (content !== next.content)
                    next = { ...next, content: content };
            }
        }
    }
    return next;
}
