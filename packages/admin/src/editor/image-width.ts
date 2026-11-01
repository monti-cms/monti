/** Width input: 1 to 100%, or a positive integer px of at most 4096. Empty means fit to the body. */
export const isValidImageWidth = (value: string) => {
	const trimmed = value.trim();
	if (!trimmed) return true;
	const percent = /^(\d{1,3})%$/.exec(trimmed);
	if (percent) return Number(percent[1]) >= 1 && Number(percent[1]) <= 100;
	const px = /^(\d{1,4})(px)?$/.exec(trimmed);
	return Boolean(px) && Number(px?.[1]) >= 1 && Number(px?.[1]) <= 4096;
};

/** A bare number is px. */
export const normalizeImageWidth = (value: string) => {
	const trimmed = value.trim();
	return /^\d+$/.test(trimmed) ? `${trimmed}px` : trimmed;
};

/** A drag of a width corner handle, from the press to the release. */
export interface ImageResize {
	/** The width the image has saved, empty when it has none (it fits the body). */
	readonly width: string;
	readonly handle: "left" | "right";
	/** Where the press was, and the image and the body width then (px on screen). */
	readonly startX: number;
	readonly startWidth: number;
	readonly parentWidth: number;
	/** The width the image shows now. */
	readonly preview: string;
	/** Whether the handle went 2px or more from the press: a press without that is a click, not a resize. */
	readonly moved: boolean;
}

export const startImageResize = (
	start: Pick<ImageResize, "width" | "handle" | "startX" | "startWidth" | "parentWidth">,
): ImageResize => ({ ...start, preview: start.width || `${Math.round(start.startWidth)}px`, moved: false });

/** The resize with the pointer at `clientX`. A % width stays %, of the body width (1 to 100); any other width is px (20 to 4096). */
export const moveImageResize = (resize: ImageResize, clientX: number): ImageResize => {
	const delta = resize.handle === "right" ? clientX - resize.startX : resize.startX - clientX;
	const next = Math.max(20, resize.startWidth + delta);
	const preview = resize.width.trim().endsWith("%")
		? `${Math.min(100, Math.max(1, Math.round((next / resize.parentWidth) * 100)))}%`
		: `${Math.min(4096, Math.max(20, Math.round(next)))}px`;
	return { ...resize, preview, moved: resize.moved || Math.abs(delta) >= 2 };
};

/** The width to save when the handle is let go, or `null` to leave the image as it is: a click keeps an image that has no width without one. */
export const releaseImageResize = (resize: ImageResize): string | null =>
	resize.moved && resize.preview !== resize.width && isValidImageWidth(resize.preview)
		? normalizeImageWidth(resize.preview)
		: null;
