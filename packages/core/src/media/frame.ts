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

/**
 * An image block's attrs (doc 09). The picture's size is a width in px (`width`) or a share of the body (`widthPercent`), never both; with neither it is its
 * own size. Either way a body narrower than it shrinks it, and its height follows its shape.
 */
const ImageUseShape = z.object({
	media: z.string(),
	alt: z.string().optional(),
	caption: z.string().optional(),
	/** Left empty on purpose: the site draws an empty alt, and no publish check asks for one (doc 09). */
	decorative: z.boolean().optional(),
	align: z.enum(["left", "center", "right"]).optional(),
	/** What of the picture shows, and how it is turned. The original is never changed. */
	crop: ImageCropShape.optional(),
	rotate: ImageRotateShape.optional(),
});
export const ImageAttrsShape = ImageUseShape.extend({
	/** Its width in px. Never wider than what shows of the picture: a wider one is drawn at the picture's own. */
	width: z.number().int().positive().optional(),
	/** Its width in % of the body, for a picture that follows the body's width. */
	widthPercent: z.number().int().min(1).max(100).optional(),
	// One flat object, so the catalog's JSON schema lists its attrs (the block menu reads `align` there); the check keeps the two widths apart.
}).refine((attrs) => attrs.width === undefined || attrs.widthPercent === undefined, {
	message: "An image's width is in px or in percent, not both.",
});
/** An image block's attrs as code holds them: at most one of the two widths, as the shape's check keeps it. */
export type ImageAttrs = z.infer<typeof ImageUseShape> &
	({ width?: number; widthPercent?: undefined } | { widthPercent: number; width?: undefined });

/**
 * The size a picture is drawn at before a narrower body shrinks it, in px (doc 09): what shows of it (its crop, turned), at the width the block gives, never
 * wider than that. `null` when the picture's size is not known.
 */
export function imageSize(
	file: { width: number | null | undefined; height: number | null | undefined },
	use: { crop?: ImageCrop | null; rotate?: ImageRotate | null; width?: number | null },
): { width: number; height: number } | null {
	const shown = shownPart(file, use);
	if (!shown) return null;
	const width = Math.max(1, Math.round(Math.min(use.width ?? shown.width, shown.width)));
	return { width, height: Math.max(1, Math.round((width * shown.height) / shown.width)) };
}

/** What shows of a picture, in its own pixels: the part its crop keeps, after it is turned. `null` when its size is not known. */
export function shownPart(
	file: { width: number | null | undefined; height: number | null | undefined },
	use: { crop?: ImageCrop | null; rotate?: ImageRotate | null },
): { width: number; height: number } | null {
	if (!file.width || !file.height) return null;
	const sideways = use.rotate === 90 || use.rotate === 270;
	const part = use.crop ?? { width: 1, height: 1 };
	return {
		width: (sideways ? file.height : file.width) * part.width,
		height: (sideways ? file.width : file.height) * part.height,
	};
}

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
