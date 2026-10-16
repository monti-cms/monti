import { type AllowedFileMime, extensionFor, isImageType, MEDIA_TYPES, sniffFile } from "../../../core/media-types";
import { detectImageDimensionsAndType } from "../../../media/image-detect";
import type { AllowedMediaMime, MediaStore } from "../../../media/store";
import type { Site } from "../../../site";
import { CmsError } from "../error-handler";

export const UPLOAD_URL_TTL_SECONDS = 600;

export { extensionFor };

export interface InspectedFile {
	head: NonNullable<Awaited<ReturnType<MediaStore["headFile"]>>>;
	detected: { mimeType: AllowedMediaMime; width: number | null; height: number | null };
}

/**
 * Inspects an uploaded staging file by its actual bytes: size, type (the client MIME is not trusted), and pixel count.
 * For attachments, checks that the `declared` type matches the actual content. When `expectedBytes` is given, the stored size must equal it. Throws `CmsError` on failure.
 */
export async function inspectUploadedFile(
	site: Site,
	mediaStore: MediaStore,
	stagingKey: string,
	declared?: string | null,
	expectedBytes?: number,
): Promise<InspectedFile> {
	const head = await mediaStore.headFile({ key: stagingKey });
	if (!head) throw new CmsError("File has not been uploaded to storage yet", "upload_incomplete");
	// The stored object must be the size the upload declared: the declared size is what the limits were checked against.
	if (expectedBytes !== undefined && head.contentLength !== expectedBytes) {
		// Bigger than declared went past the checked limit; smaller means the upload did not finish.
		throw new CmsError(
			`Uploaded file is ${head.contentLength} bytes but ${expectedBytes} bytes were declared`,
			head.contentLength > expectedBytes ? "payload_too_large" : "upload_incomplete",
		);
	}

	if (declared && !isImageType(declared)) {
		if (!(site.api.ALLOWED_FILE_MIME_TYPES as readonly string[]).includes(declared)) {
			throw new CmsError(`File type ${declared} is not allowed`, "unsupported_media_type");
		}
		if (head.contentLength > site.api.MAX_FILE_BYTES) {
			throw new CmsError(`Uploaded file exceeds ${site.api.MAX_FILE_BYTES} bytes`, "payload_too_large");
		}
		const mimeType = declared as AllowedFileMime;
		const sniff = MEDIA_TYPES[mimeType].sniffBytes;
		// Empty files are not read (only an empty text file passes).
		const bytes =
			head.contentLength > 0
				? mediaStore.readPrefix
					? await mediaStore.readPrefix({ key: stagingKey, bytes: Math.min(sniff, head.contentLength) })
					: (await mediaStore.readFile({ key: stagingKey, maxBytes: head.contentLength })).subarray(0, sniff)
				: new Uint8Array();
		if (!sniffFile(bytes, mimeType)) {
			throw new CmsError(`Uploaded file is not a valid ${mimeType} file`, "unsupported_media_type");
		}
		return { head, detected: { mimeType, width: null, height: null } };
	}

	if (head.contentLength > site.api.MAX_MEDIA_BYTES) {
		throw new CmsError(`Uploaded image exceeds ${site.api.MAX_MEDIA_BYTES} bytes`, "payload_too_large");
	}
	const bytes = await mediaStore.readFile({ key: stagingKey, maxBytes: site.api.MAX_MEDIA_BYTES + 1 });
	const detected = detectImageDimensionsAndType(bytes);
	if (!detected || !(site.api.ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(detected.mimeType)) {
		throw new CmsError("Uploaded file is not a valid or allowed image format", "unsupported_media_type");
	}
	if (detected.width * detected.height > site.api.MAX_MEDIA_PIXELS) {
		throw new CmsError(`Image exceeds ${site.api.MAX_MEDIA_PIXELS} pixels`, "too_many_pixels");
	}
	return { head, detected };
}

/** Header value that makes an attachment download under its original name (RFC 6266, 5987). */
export function attachmentDisposition(filename: string): string {
	const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

/** The extension of a file name (lowercase, with the dot), or an empty string. */
const extensionOf = (filename: string) => /\.[^./\\]{1,16}$/.exec(filename)?.[0]?.toLowerCase() ?? "";

/**
 * Why a new file name is not acceptable, or `null`. The name is a display and download name, so it stays one plain name (no path, no control
 * characters), has something before the extension, and keeps the extension of the file: the stored type does not change with a rename.
 */
export function renameProblem(current: string, next: string): string | null {
	// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are what this rejects
	if (/[/\\\u0000-\u001f\u007f]/.test(next) || next === "." || next === "..") {
		return "A file name can't contain slashes or control characters";
	}
	const extension = extensionOf(current);
	if (extensionOf(next) !== extension) return `The file name must keep the extension ${extension || "(none)"}`;
	if (next.slice(0, next.length - extension.length).trim() === "")
		return "The file name needs a name before the extension";
	return null;
}
