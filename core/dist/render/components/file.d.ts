import type { ImageResolver } from "../../mdx/image-src.js";
/**
 * Attachment file card (`::file{mediaId label}`). The address is decided by the resolver passed in (same as images). If it cannot be resolved, only the name shows and
 * there is no download.
 */
export declare function CmsFile({ mediaId, label, resolve, downloadLabel, unavailableLabel, }: {
    mediaId?: string;
    label?: string;
    resolve?: ImageResolver;
    downloadLabel?: string;
    unavailableLabel?: string;
}): import("react").JSX.Element;
