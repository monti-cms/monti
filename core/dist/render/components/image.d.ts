import { type ImageResolver } from "../../doc/image-src.js";
/** `width` accepts only 1 to 100% or 1 to 4096px. Other values are ignored. */
export declare const validImageWidth: (value?: string) => string | undefined;
/**
 * `::image{...}`. The address is decided by the resolver (`resolve`) passed by the caller (only the outer `src` if there is none), and this component does not read the DB.
 * If it cannot be resolved, only an empty slot and the caption remain, and `width` and `align` are not used. The failure reason is not shown and it is not replaced with `alt`.
 */
export declare function CmsImage({ mediaId, src, alt, width, align, caption, decorative, crop, title, rotate, resolve, unavailableLabel, }: {
    mediaId?: string;
    src?: string;
    alt?: string;
    width?: string;
    align?: string;
    caption?: string;
    decorative?: boolean;
    crop?: string;
    title?: string;
    rotate?: string | number;
    resolve?: ImageResolver;
    unavailableLabel?: string;
}): import("react").JSX.Element | null;
