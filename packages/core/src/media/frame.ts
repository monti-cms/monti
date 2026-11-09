import { z } from "zod";

/** What of a picture shows, as parts of it after it is turned. An image block's `crop`. */
export const ImageCropShape = z
	.object({
		x: z.number().min(0).max(1),
		y: z.number().min(0).max(1),
		width: z.number().positive().max(1),
		height: z.number().positive().max(1),
	})
	// Inside the picture, give or take what sums of fractions lose.
	.refine((crop) => crop.x + crop.width <= 1.000001 && crop.y + crop.height <= 1.000001);
export type ImageCrop = z.infer<typeof ImageCropShape>;

/** An image block's `rotate`. */
export const ImageRotateShape = z.union([z.literal(0), z.literal(90), z.literal(180), z.literal(270)]);
export type ImageRotate = z.infer<typeof ImageRotateShape>;

/** How to draw a cropped or turned picture: a box of this shape that hides what is outside it, and the picture placed in it, in % of the box. */
export type ImageFrame = {
	aspectRatio: number;
	image: { left: number; top: number; width: number; height: number; rotate: ImageRotate };
};

/** Where a picture sits in the column: the middle unless it says otherwise (doc 09). The editor and the site read it here. */
export const imageAlignOf = (align: unknown): "left" | "center" | "right" =>
	align === "left" || align === "right" ? align : "center";

/**
 * The one sum for a cropped or turned picture, so the editor and the site draw the same (doc 09). The original is never changed. `null` when there is nothing to
 * do, or the picture's size is not known.
 */
export function imageFrame({
	width,
	height,
	crop,
	rotate = 0,
}: {
	width: number | null | undefined;
	height: number | null | undefined;
	crop?: ImageCrop | null;
	rotate?: ImageRotate | null;
}): ImageFrame | null {
	const turn = rotate ?? 0;
	if ((!crop && turn === 0) || !width || !height) return null;
	const part = crop ?? { x: 0, y: 0, width: 1, height: 1 };
	const sideways = turn === 90 || turn === 270;
	const turnedWidth = sideways ? height : width;
	const turnedHeight = sideways ? width : height;
	return {
		aspectRatio: (turnedWidth * part.width) / (turnedHeight * part.height),
		image: {
			// The picture's centre, wherever the crop moved the turned picture to.
			left: ((0.5 - part.x) / part.width) * 100,
			top: ((0.5 - part.y) / part.height) * 100,
			width: (width / (turnedWidth * part.width)) * 100,
			height: (height / (turnedHeight * part.height)) * 100,
			rotate: turn,
		},
	};
}
