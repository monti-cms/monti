import { entryLinkIds } from "./entry-links.js";
import { resolveImageUrl } from "./image-src.js";
/** The refs of a document with nothing to resolve. */
export const EMPTY_REFS = Object.freeze({ media: Object.freeze({}), links: Object.freeze({}) });
const MEDIA_NODE_TYPES = new Set(["image", "file"]);
/** The ids a document points to (a pure walk over every node, inline images included). A missing or malformed document has none. */
export function collectRefs(doc) {
    const media = new Set();
    const visit = (nodes) => {
        for (const node of nodes ?? []) {
            if (MEDIA_NODE_TYPES.has(node.type)) {
                const mediaId = node.attrs?.mediaId;
                if (typeof mediaId === "string" && mediaId)
                    media.add(mediaId);
            }
            visit(node.content);
        }
    };
    visit(doc?.content);
    return { media: [...media], links: entryLinkIds(doc?.content) };
}
/**
 * The image resolver the renderer uses for a set of refs: a registered media id is looked up in `refs.media` (one that is not there is unresolved),
 * and an outer `src` goes through the same allow rules as everywhere else.
 */
export const imageResolverFromRefs = (refs) => ({ mediaId, src }) => {
    if (mediaId)
        return refs.media[mediaId] ?? { failure: "unresolved" };
    return resolveImageUrl(src) ?? { failure: "unresolved" };
};
