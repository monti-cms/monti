import { WEB_LONGEST_SIDE } from "@monti-cms/core";
import { fitLongSide } from "./fit";

/** A picture as the browser reads it, turned the way its EXIF says, or `null` when no picture comes out of the file. */
export async function readPicture(file: Blob): Promise<ImageBitmap | null> {
	try {
		return await createImageBitmap(file, { imageOrientation: "from-image" });
	} catch {
		return null;
	}
}

const QUALITY = 0.85;

/** WebP keeps transparency and is small; a JPEG stays a JPEG. A browser that cannot write WebP answers with a PNG, which the library takes too. */
const outputType = (mime: string) => (mime === "image/jpeg" ? "image/jpeg" : "image/webp");
const extensionOf = (type: string) =>
	type === "image/jpeg" ? ".jpg" : type === "image/png" ? ".png" : type === "image/gif" ? ".gif" : ".webp";

async function draw(picture: ImageBitmap, width: number, height: number, mime: string): Promise<Blob | null> {
	const canvas = new OffscreenCanvas(width, height);
	const context = canvas.getContext("2d");
	if (!context) return null;
	context.imageSmoothingQuality = "high";
	context.drawImage(picture, 0, 0, width, height);
	return canvas.convertToBlob({ type: outputType(mime), quality: QUALITY });
}

/**
 * An image's web size (doc 09): a copy with its long side at 2400, for one larger than that. A GIF has none, because a copy would lose its movement. The site uses the
 * original of anything else.
 */
export async function webSize(picture: ImageBitmap, mime: string) {
	if (mime === "image/gif" || Math.max(picture.width, picture.height) <= WEB_LONGEST_SIDE) return null;
	const size = fitLongSide(picture.width, picture.height, WEB_LONGEST_SIDE);
	const blob = await draw(picture, size.width, size.height, mime);
	return blob ? { blob, ...size, name: `web${extensionOf(blob.type)}` } : null;
}

/** The long side of a picture's placeholder: enough for a blur, small enough to go with every entry the site reads. */
const PLACEHOLDER_SIDE = 20;

/**
 * A picture's placeholder (doc 09): a copy 20px on its long side, as a data URL, that a site shows blurred until the picture comes (next/image's
 * `blurDataURL`). `undefined` when the browser cannot draw one; the picture goes up without it.
 */
export async function placeholderOf(picture: ImageBitmap): Promise<string | undefined> {
	const size = fitLongSide(picture.width, picture.height, PLACEHOLDER_SIDE);
	const canvas = new OffscreenCanvas(Math.max(1, size.width), Math.max(1, size.height));
	const context = canvas.getContext("2d");
	if (!context) return undefined;
	context.drawImage(picture, 0, 0, canvas.width, canvas.height);
	const blob = await canvas.convertToBlob({ type: "image/webp", quality: 0.5 }).catch(() => null);
	if (!blob) return undefined;
	let binary = "";
	for (const byte of new Uint8Array(await blob.arrayBuffer())) binary += String.fromCharCode(byte);
	return `data:${blob.type};base64,${btoa(binary)}`;
}
