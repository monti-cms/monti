import { type CSSProperties } from "react";
/**
 * Body image (browser). Crop and rotate need the original aspect ratio, so they are fitted in the browser. The slot is reserved first with the original size the server knows.
 * If it cannot be read, an empty slot and `unavailableLabel` are shown.
 */
export declare function CmsImageView({ src, alt, decorative, style, crop, rotate, title, intrinsicSize, unavailableLabel, }: {
    src: string;
    alt: string;
    decorative?: boolean;
    style?: CSSProperties;
    crop?: string;
    rotate?: string | number;
    title?: string;
    intrinsicSize?: {
        width: number;
        height: number;
    };
    unavailableLabel: string;
}): import("react").JSX.Element;
