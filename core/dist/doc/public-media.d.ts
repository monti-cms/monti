import type { ContentStore } from "../core/store/index.js";
import type { MediaStore } from "../media/store.js";
import type { ImageResolveResult } from "./image-src.js";
/** The stores the public media helpers read. They are looked up when used, so nothing connects until then. */
export interface PublicMediaDeps {
    readonly store: () => ContentStore;
    readonly mediaStore: () => MediaStore;
}
/**
 * Resolves registered media ids into public URLs, sizes and file info (a ready file) or the reason there is none. Ids with no media row are left out
 * (the resolvers read them as unresolved). A deployment without a database or storage resolves nothing and still renders.
 */
export declare function resolvePublicMedia(deps: PublicMediaDeps, mediaIds: readonly string[]): Promise<Map<string, ImageResolveResult>>;
/**
 * Public URL of one media item (shared image etc.). `null` if it is not ready or the deployment has no DB or storage.
 */
export declare function resolvePublicMediaUrl(deps: PublicMediaDeps, mediaId: string): Promise<{
    url: string;
    width?: number;
    height?: number;
} | null>;
