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

const round2 = (n: number): number => Math.round(n * 100) / 100;
const round4 = (n: number): number => Math.round(n * 10000) / 10000;

const CROP_REGEX =
	/^\s*(\d+(?:\.\d{1,2})?)\s*,\s*(\d+(?:\.\d{1,2})?)\s*,\s*(\d+(?:\.\d{1,2})?)\s*,\s*(\d+(?:\.\d{1,2})?)\s*$/;
const ROTATE_REGEX = /^(?:0|90|180|270)$/;

/** Rounds by the edges so that `x + width` and `y + height` do not exceed 100%. */
export function roundCropBox(box: CropBox): CropBox {
	const x = round2(box.x);
	const y = round2(box.y);
	return {
		x,
		y,
		width: round2(Math.min(round2(box.x + box.width), 100) - x),
		height: round2(Math.min(round2(box.y + box.height), 100) - y),
	};
}

/** Parses a `crop="x,y,w,h"` string. Returns null for an invalid format. */
export function parseCrop(value: unknown): CropBox | null {
	if (typeof value !== "string") return null;
	const match = CROP_REGEX.exec(value);
	if (!match) return null;

	const rawX = Number(match[1]);
	const rawY = Number(match[2]);
	const rawWidth = Number(match[3]);
	const rawHeight = Number(match[4]);
	if (!Number.isFinite(rawX) || !Number.isFinite(rawY) || !Number.isFinite(rawWidth) || !Number.isFinite(rawHeight)) {
		return null;
	}

	const x = round2(rawX);
	const y = round2(rawY);
	const width = round2(rawWidth);
	const height = round2(rawHeight);

	// Validate after range check and rounding:
	// 0 <= x < 100, 0 <= y < 100, 0 < w <= 100, 0 < h <= 100, x + w <= 100, y + h <= 100
	if (x < 0 || x >= 100 || y < 0 || y >= 100) return null;
	if (width <= 0 || width > 100 || height <= 0 || height > 100) return null;
	if (round2(x + width) > 100 || round2(y + height) > 100) return null;

	return {
		x,
		y,
		width,
		height,
	};
}

/** Parses a `rotate="90|180|270"` string or number. Returns null for 0 or invalid values. */
export function parseRotate(value: unknown): RotateDegree | null {
	if (value === null || value === undefined || value === "") return null;
	const str = typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "";
	if (!ROTATE_REGEX.test(str)) return null;
	const num = Number(str);
	if (num === 90 || num === 180 || num === 270) return num;
	return null;
}

/** Serializes a CropBox into a `crop="x,y,w,h"` string (2 decimal places). */
export function formatCrop(crop: CropBox): string {
	return `${round2(crop.x)},${round2(crop.y)},${round2(crop.width)},${round2(crop.height)}`;
}

/** Checks whether it is the full image (no crop). */
export function isFullCrop(crop: CropBox | null): boolean {
	if (!crop) return true;
	return crop.x === 0 && crop.y === 0 && crop.width === 100 && crop.height === 100;
}

/** Checks whether it is a valid crop attribute value. */
export function isValidCrop(value: unknown): boolean {
	if (value === null || value === undefined || value === "") return true;
	return parseCrop(value) !== null;
}

/** Checks whether it is a valid rotate attribute value. Only 0, empty, 90, 180 and 270 are valid. */
export function isValidRotate(value: unknown): boolean {
	if (value === null || value === undefined || value === "" || value === "0" || value === 0) return true;
	return parseRotate(value) !== null;
}

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
export function computeImageTransform(options: ImageTransformOptions): ImageTransformStyles {
	const rawCrop = parseCrop(options.crop);
	const crop = isFullCrop(rawCrop) ? null : rawCrop;
	const rotate = parseRotate(options.rotate);

	if (!crop && !rotate) {
		return {
			wrapperStyle: {},
			imageStyle: {},
			isTransformed: false,
			crop: null,
			rotate: null,
		};
	}

	const w = crop ? crop.width : 100;
	const h = crop ? crop.height : 100;
	const x = crop ? crop.x : 0;
	const y = crop ? crop.y : 0;

	// Original image ratio (width / height). If not given, w / h is used as the ratio.
	const baseAspect = typeof options.aspectRatio === "number" && options.aspectRatio > 0 ? options.aspectRatio : 1;
	const cropAspect = (w / h) * baseAspect;

	const isRotated90or270 = rotate === 90 || rotate === 270;
	const finalAspect = isRotated90or270 ? 1 / cropAspect : cropAspect;

	// Offset of the crop area's center from the original image's center (50%)
	const dx = x + w / 2 - 50;
	const dy = y + h / 2 - 50;

	const wrapperStyle: CSSProperties = {
		position: "relative",
		overflow: "hidden",
		aspectRatio: round4(finalAspect),
	};

	let imageStyle: CSSProperties;

	if (isRotated90or270) {
		imageStyle = {
			position: "absolute",
			top: "50%",
			left: "50%",
			width: `${round4((100 / h) * baseAspect * 100)}%`,
			height: `${round4((100 / (w * baseAspect)) * 100)}%`,
			maxWidth: "none",
			maxHeight: "none",
			transform: `translate(-50%, -50%) rotate(${rotate}deg) translate(${round4(-dx)}%, ${round4(-dy)}%)`,
		};
	} else {
		const rotateTransform = rotate === 180 ? " rotate(180deg)" : "";
		imageStyle = {
			position: "absolute",
			top: "50%",
			left: "50%",
			width: `${round4((100 / w) * 100)}%`,
			height: `${round4((100 / h) * 100)}%`,
			maxWidth: "none",
			maxHeight: "none",
			transform: `translate(-50%, -50%)${rotateTransform} translate(${round4(-dx)}%, ${round4(-dy)}%)`,
		};
	}

	return {
		wrapperStyle,
		imageStyle,
		isTransformed: true,
		crop,
		rotate,
	};
}

/**
 * Display width (px) of a transformed image with no width set. It looks the same as without the transform, using **the original size of the visible area**.
 * If the original size is not known yet, `null` — the caller uses the parent width meanwhile (prevents shrinking to 0).
 */
export function intrinsicDisplayWidth(
	transform: Pick<ImageTransformStyles, "crop" | "rotate">,
	natural: { width: number; height: number } | null,
): number | null {
	if (!natural || natural.width <= 0 || natural.height <= 0) return null;
	const cropWidth = transform.crop?.width ?? 100;
	const cropHeight = transform.crop?.height ?? 100;
	const sideways = transform.rotate === 90 || transform.rotate === 270;
	const width = sideways ? (natural.height * cropHeight) / 100 : (natural.width * cropWidth) / 100;
	return Math.max(1, Math.round(width));
}
