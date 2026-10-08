import type { CSSProperties } from "react";
/**
 * Pure functions for image crop and rotate.
 *
 * - The original file is left as is; the display attributes `crop="x,y,w,h"` and `rotate="90|180|270"` are written on `::image`.
 * - crop: percentages of the original (0 to 100, up to 2 decimal places). Missing or full (0,0,100,100) means no crop/full image.
 * - rotate: clockwise (90 | 180 | 270). Missing or 0 means no rotation.
 * - The site's public image renderer and the admin editor's image block
 *   use the same functions to compute CSS styles. Invalid values are ignored (same as the width rule).
 */
export interface CropBox {
    /** Left start position (0 to 100 %) */
    x: number;
    /** Top start position (0 to 100 %) */
    y: number;
    /** Crop area width (0 to 100 %) */
    width: number;
    /** Crop area height (0 to 100 %) */
    height: number;
}
export type RotateDegree = 90 | 180 | 270;
/** Rounds by the edges so that `x + width` and `y + height` do not exceed 100%. */
export declare function roundCropBox(box: CropBox): CropBox;
/** Parses a `crop="x,y,w,h"` string. Returns null for an invalid format. */
export declare function parseCrop(value: unknown): CropBox | null;
/** Parses a `rotate="90|180|270"` string or number. Returns null for 0 or invalid values. */
export declare function parseRotate(value: unknown): RotateDegree | null;
/** Serializes a CropBox into a `crop="x,y,w,h"` string (2 decimal places). */
export declare function formatCrop(crop: CropBox): string;
/** Checks whether it is the full image (no crop). */
export declare function isFullCrop(crop: CropBox | null): boolean;
/** Checks whether it is a valid crop attribute value. */
export declare function isValidCrop(value: unknown): boolean;
/** Checks whether it is a valid rotate attribute value. Only 0, empty, 90, 180 and 270 are valid. */
export declare function isValidRotate(value: unknown): boolean;
export interface ImageTransformStyles {
    wrapperStyle: CSSProperties;
    imageStyle: CSSProperties;
    isTransformed: boolean;
    crop: CropBox | null;
    rotate: RotateDegree | null;
}
export interface ImageTransformOptions {
    crop?: string | null;
    rotate?: string | number | null;
    /** Aspect ratio of the original image (naturalWidth / naturalHeight). Assumed to be 1 if unknown. */
    aspectRatio?: number | null;
}
/**
 * Computes the crop and rotate CSS styles.
 *
 * - crop: wrapper `overflow: hidden` + `aspect-ratio` + img scale and offset (CSS)
 * - rotate: rotate with `transform` (for 90 and 270 degrees, width and height ratio are swapped)
 * - Invalid values are ignored (no style applied).
 */
export declare function computeImageTransform(options: ImageTransformOptions): ImageTransformStyles;
/**
 * Display width (px) of a transformed image with no width set. It looks the same as without the transform, using **the original size of the visible area**.
 * If the original size is not known yet, `null` — the caller uses the parent width meanwhile (prevents shrinking to 0).
 */
export declare function intrinsicDisplayWidth(transform: Pick<ImageTransformStyles, "crop" | "rotate">, natural: {
    width: number;
    height: number;
} | null): number | null;
