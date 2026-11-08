import { MAX_UPLOAD_BYTES, splitName, WEB_LONGEST_SIDE } from "@monti-cms/core";
import { firstShrink, fitLongSide } from "./fit";

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

/** "Shrink and retry" (flow 6·04): the same picture, its sides reduced step by step until it is under the limit. `null` when it cannot be read or will not come under. */
export async function shrunk(file: File): Promise<File | null> {
	const picture = await readPicture(file);
	if (!picture) return null;
	let scale = firstShrink(file.size, MAX_UPLOAD_BYTES);
	for (let tries = 0; tries < 6; tries++) {
		const blob = await draw(
			picture,
			Math.max(1, Math.round(picture.width * scale)),
			Math.max(1, Math.round(picture.height * scale)),
			file.type,
		);
		if (!blob) return null;
		if (blob.size <= MAX_UPLOAD_BYTES)
			return new File([blob], `${splitName(file.name).stem}${extensionOf(blob.type)}`, { type: blob.type });
		scale *= 0.85;
	}
	return null;
}
