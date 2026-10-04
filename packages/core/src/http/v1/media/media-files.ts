import type { AllowedMediaMime, MediaStore } from "../../../adapters/r2/types";
import {
	ALLOWED_FILE_MIME_TYPES,
	ALLOWED_IMAGE_MIME_TYPES,
	type AllowedFileMime,
	isImageMime,
	MAX_FILE_BYTES,
	MAX_MEDIA_BYTES,
	MAX_MEDIA_PIXELS,
} from "../../../core/api";
import { detectImageDimensionsAndType } from "../../../media/image-detect";
import { HttpError } from "../error-handler";

export const UPLOAD_URL_TTL_SECONDS = 600;

const EXTENSIONS: Record<AllowedMediaMime, string> = {
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/webp": "webp",
	"image/gif": "gif",
	"image/avif": "avif",
	"application/pdf": "pdf",
	"application/zip": "zip",
	"text/plain": "txt",
	"text/markdown": "md",
	"text/csv": "csv",
	"application/json": "json",
};

/** 파일 키의 확장자는 사용자가 준 파일명 대신 형식에서 정한다. */
export const extensionFor = (mimeType: AllowedMediaMime) => EXTENSIONS[mimeType];

/** 글자 파일은 앞부분만 읽어 확인한다. */
const TEXT_SNIFF_BYTES = 64 * 1024;

const startsWith = (bytes: Uint8Array, signature: readonly number[]) =>
	signature.every((byte, index) => bytes[index] === byte);

/**
 * 첨부 파일의 실제 바이트가 선언한 형식과 맞는지 본다. PDF·zip은 파일 서명으로, 글자 파일은
 * UTF-8로 읽히고 NUL 바이트가 없는지로 확인한다(바이너리를 글자 파일로 올리는 것을 막는다).
 */
function detectFileType(bytes: Uint8Array, declared: AllowedFileMime): boolean {
	switch (declared) {
		case "application/pdf":
			return startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]); // %PDF-
		case "application/zip":
			// 일반 zip과 빈 zip.
			return startsWith(bytes, [0x50, 0x4b, 0x03, 0x04]) || startsWith(bytes, [0x50, 0x4b, 0x05, 0x06]);
		default: {
			if (bytes.includes(0)) return false;
			try {
				// 앞부분만 읽어 마지막 글자가 잘렸을 수 있다. 끝의 3바이트는 검사에서 뺀다.
				const end = bytes.length >= TEXT_SNIFF_BYTES ? Math.max(0, bytes.length - 3) : bytes.length;
				new TextDecoder("utf-8", { fatal: true }).decode(bytes.subarray(0, end));
				return true;
			} catch {
				return false;
			}
		}
	}
}

export interface InspectedFile {
	head: NonNullable<Awaited<ReturnType<MediaStore["headFile"]>>>;
	detected: { mimeType: AllowedMediaMime; width: number | null; height: number | null };
}

/**
 * 업로드된 staging 파일을 실제 바이트로 검사한다(§7.1): 크기, 형식(클라이언트 MIME을 믿지 않는다), 픽셀 수.
 * 첨부 파일(v3)은 `declared` 형식과 실제 내용이 맞는지 본다. 실패하면 `HttpError`를 던진다.
 */
export async function inspectUploadedFile(
	mediaStore: MediaStore,
	stagingKey: string,
	declared?: string | null,
): Promise<InspectedFile> {
	const head = await mediaStore.headFile({ key: stagingKey });
	if (!head) throw new HttpError(409, "upload_incomplete", "File has not been uploaded to storage yet");

	if (declared && !isImageMime(declared)) {
		if (!(ALLOWED_FILE_MIME_TYPES as readonly string[]).includes(declared)) {
			throw new HttpError(415, "unsupported_media_type", `File type ${declared} is not allowed`);
		}
		if (head.contentLength > MAX_FILE_BYTES) {
			throw new HttpError(413, "payload_too_large", `Uploaded file exceeds ${MAX_FILE_BYTES} bytes`);
		}
		const mimeType = declared as AllowedFileMime;
		const sniff = mimeType === "application/pdf" || mimeType === "application/zip" ? 8 : TEXT_SNIFF_BYTES;
		// 빈 파일은 읽지 않는다(빈 글자 파일만 통과한다).
		const bytes =
			head.contentLength > 0
				? mediaStore.readPrefix
					? await mediaStore.readPrefix({ key: stagingKey, bytes: Math.min(sniff, head.contentLength) })
					: (await mediaStore.readFile({ key: stagingKey, maxBytes: head.contentLength })).subarray(0, sniff)
				: new Uint8Array();
		if (!detectFileType(bytes, mimeType)) {
			throw new HttpError(415, "unsupported_media_type", `Uploaded file is not a valid ${mimeType} file`);
		}
		return { head, detected: { mimeType, width: null, height: null } };
	}

	if (head.contentLength > MAX_MEDIA_BYTES) {
		throw new HttpError(413, "payload_too_large", `Uploaded image exceeds ${MAX_MEDIA_BYTES} bytes`);
	}
	const bytes = await mediaStore.readFile({ key: stagingKey, maxBytes: MAX_MEDIA_BYTES + 1 });
	const detected = detectImageDimensionsAndType(bytes);
	if (!detected || !(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(detected.mimeType)) {
		throw new HttpError(415, "unsupported_media_type", "Uploaded file is not a valid or allowed image format");
	}
	if (detected.width * detected.height > MAX_MEDIA_PIXELS) {
		throw new HttpError(413, "too_many_pixels", `Image exceeds ${MAX_MEDIA_PIXELS} pixels`);
	}
	return { head, detected };
}

/** 첨부 파일을 원래 이름으로 내려받게 하는 헤더 값(RFC 6266·5987). */
export function attachmentDisposition(filename: string): string {
	const ascii = filename.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
	return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}
