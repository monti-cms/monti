import { type CropBox, formatCrop, isFullCrop, type RotateDegree } from "@monti-cms/core/document";

/** The whole image: no crop. */
export const FULL_CROP: CropBox = { x: 0, y: 0, width: 100, height: 100 };

const round2 = (n: number) => Math.round(n * 100) / 100;
const clamp = (val: number, min: number, max: number) => Math.min(max, Math.max(min, val));

/**
 * The crop with one of its numbers typed in. The box stays inside the image: a start moves the box's size in, a size stops at the image's edge.
 * Not a number leaves the crop as it is.
 */
export function setCropValue(crop: CropBox, field: keyof CropBox, value: number): CropBox {
	if (!Number.isFinite(value)) return crop;
	const val = round2(value);
	let { x, y, width, height } = crop;
	if (field === "x") {
		x = clamp(val, 0, 99);
		if (x + width > 100) width = round2(100 - x);
	} else if (field === "y") {
		y = clamp(val, 0, 99);
		if (y + height > 100) height = round2(100 - y);
	} else if (field === "width") {
		width = clamp(val, 1, round2(100 - x));
	} else {
		height = clamp(val, 1, round2(100 - y));
	}
	return { x, y, width, height };
}

/**
 * What the crop sheet saves on the image. The crop is in percent of the original image, whatever the rotation: the rotation is applied on top of it
 * when the image is shown. The whole image and no rotation are saved as nothing.
 */
export function cropSheetResult(
	crop: CropBox,
	rotate: 0 | RotateDegree,
): { crop: string | null; rotate: string | null } {
	return { crop: isFullCrop(crop) ? null : formatCrop(crop), rotate: rotate === 0 ? null : String(rotate) };
}
