import { ImageAttrsShape, type ImageFrame, imageFrame, imageSize } from "./frame";

/** A media file as the site uses it (doc 09): the web size when there is one, the original when it is small enough already. */
export type SiteMedia = {
	id: string;
	name: string;
	kind: "image" | "file";
	mime: string;
	size: number;
	url: string;
	width: number | null;
	height: number | null;
	/** The file as it went up, for a site that lets a picture be opened at full size or saved. */
	original: { url: string; width: number | null; height: number | null };
	/** A picture 20px on its long side, as a data URL, to show blurred until the picture comes (next/image's `blurDataURL`). */
	placeholder: string | null;
};

/**
 * One picture as a site draws it (doc 09), from an image block's attrs or a media field's value: what a site's image component takes as it is
 * (`<Image src width height alt placeholder="blur" blurDataURL>`), with no sum of its own.
 */
export type SiteImage = {
	/** The web size, or the original when there is none. */
	src: string;
	/**
	 * The size it is drawn at, in px, before a narrower body shrinks it (`max-width: 100%; height: auto`): the block's width, else what shows of the picture
	 * (its crop, turned). Its shape is the picture's as it shows.
	 */
	width: number;
	height: number;
	/** A share of the body in % the block gives instead of a width: draw it at this width, keeping the shape `width` and `height` give. */
	widthPercent: number | null;
	/** Empty for a decorative picture. */
	alt: string;
	placeholder: string | null;
	/** For a cropped or turned picture: how to place the file in a box of the shape that shows (`imageFrameStyle`). */
	frame: ImageFrame | null;
	original: { src: string; width: number | null; height: number | null };
};

/**
 * The picture an image block or a media field's value names, as a site draws it, from the entry's `media` (the reader's). `null` when the value names no
 * picture, or the entry does not have its file.
 */
export function siteImage(value: unknown, media: Readonly<Record<string, SiteMedia>> | undefined): SiteImage | null {
	const parsed = ImageAttrsShape.safeParse(value);
	if (!parsed.success) return null;
	const use = parsed.data;
	const file = media?.[use.media];
	const size = file?.kind === "image" ? imageSize(file, use) : null;
	if (!file || !size) return null;
	return {
		src: file.url,
		width: size.width,
		height: size.height,
		widthPercent: use.widthPercent ?? null,
		alt: use.decorative === true ? "" : (use.alt ?? ""),
		placeholder: file.placeholder,
		frame: imageFrame({ width: file.width, height: file.height, crop: use.crop, rotate: use.rotate }),
		original: { src: file.original.url, width: file.original.width, height: file.original.height },
	};
}

/**
 * The two styles of a cropped or turned picture (`SiteImage.frame`), for a site's own component: a box of the shape that shows, which hides the rest, and
 * the file placed in it. Give the box the picture's width; `renderDocument` draws with the same.
 */
export function imageFrameStyle(frame: ImageFrame) {
	return {
		box: { display: "block", position: "relative", overflow: "hidden", aspectRatio: frame.aspectRatio },
		picture: {
			position: "absolute",
			maxWidth: "none",
			left: `${frame.image.left}%`,
			top: `${frame.image.top}%`,
			width: `${frame.image.width}%`,
			height: `${frame.image.height}%`,
			transform: `translate(-50%, -50%) rotate(${frame.image.rotate}deg)`,
		},
	} as const;
}
