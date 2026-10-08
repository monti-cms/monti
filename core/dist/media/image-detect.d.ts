import type { AllowedImageMime } from "../media/store.js";
/**
 * Reads the format and size from the start of an image file (PNG, GIF, JPEG, WebP, AVIF). Used to check uploaded files regardless of store type.
 */
export interface ImageDimensionsAndType {
    mimeType: AllowedImageMime;
    width: number;
    height: number;
}
export declare function detectImageDimensionsAndType(buffer: Uint8Array): ImageDimensionsAndType | null;
