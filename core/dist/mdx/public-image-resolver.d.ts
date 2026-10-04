import "server-only";
import { type ImageResolveResult } from "./image-src.js";
/** Connects public MDX so that it resolves registered media into actual public URLs. */
export declare function createPublicImageResolver(source: string): Promise<({ mediaId, src }: {
    mediaId?: string;
    src?: string;
}) => ImageResolveResult>;
export { resolvePublicMediaUrl } from "./public-media-url.js";
