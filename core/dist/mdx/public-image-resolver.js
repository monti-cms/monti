import "server-only";
import { getCmsContentStore, getCmsMediaStore } from "../container.js";
import { analyze } from "./analyze.js";
import { resolveImageUrl } from "./image-src.js";
const isNode = (value) => typeof value === "object" && value !== null;
const isAttribute = (value) => typeof value === "object" && value !== null;
function readAttribute(node, name) {
    if (!Array.isArray(node.attributes))
        return undefined;
    const attribute = node.attributes.find((item) => isAttribute(item) && item.name === name);
    return typeof attribute?.value === "string" ? attribute.value : undefined;
}
function collectMediaIds(source) {
    const ids = new Set();
    const tree = analyze(source).tree;
    const visit = (node) => {
        if (!isNode(node))
            return;
        // The attachment file card uses the same media table.
        if ((node.type === "mdxJsxFlowElement" || node.type === "mdxJsxTextElement") &&
            (node.name === "Image" || node.name === "File")) {
            const mediaId = readAttribute(node, "mediaId");
            if (mediaId)
                ids.add(mediaId);
        }
        if (Array.isArray(node.children))
            node.children.forEach(visit);
    };
    visit(tree);
    return [...ids];
}
/** Connects public MDX so that it resolves registered media into actual public URLs. */
export async function createPublicImageResolver(source) {
    const urls = new Map();
    const mediaIds = collectMediaIds(source);
    if (mediaIds.length > 0) {
        try {
            const store = getCmsContentStore();
            const mediaStore = getCmsMediaStore();
            await Promise.all(mediaIds.map(async (mediaId) => {
                const media = await store.getMediaAsset(mediaId);
                if (!media)
                    return;
                if (media.status !== "ready") {
                    urls.set(mediaId, { failure: "not-ready" });
                    return;
                }
                if (!media.storageKey) {
                    urls.set(mediaId, { failure: "unresolved" });
                    return;
                }
                const url = mediaStore.getPublicUrl(media.storageKey);
                const { width, height } = media;
                const file = { filename: media.filename, byteSize: media.byteSize, mimeType: media.mimeType };
                urls.set(mediaId, width && height && width > 0 && height > 0 ? { url, width, height, file } : { url, file });
            }));
        }
        catch {
            // Keystatic/public-only deployments may not configure the CMS database or R2.
            // Keep rendering and let CmsImage show its neutral fallback.
        }
    }
    return ({ mediaId, src }) => {
        if (mediaId)
            return urls.get(mediaId) ?? { failure: "unresolved" };
        return resolveImageUrl(src) ?? { failure: "unresolved" };
    };
}
export { resolvePublicMediaUrl } from "./public-media-url.js";
