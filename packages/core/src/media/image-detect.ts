import type { AllowedImageMime } from "../adapters/r2/types";

/**
 * 이미지 파일 앞부분으로 형식과 크기를 읽는다(PNG·GIF·JPEG·WebP·AVIF). 저장소 종류와 상관없이 올린 파일을 확인할 때 쓴다.
 */
export interface ImageDimensionsAndType {
	mimeType: AllowedImageMime;
	width: number;
	height: number;
}

export function detectImageDimensionsAndType(buffer: Uint8Array): ImageDimensionsAndType | null {
	if (!buffer || buffer.length < 16) return null;

	// 1. PNG: 89 50 4E 47 0D 0A 1A 0A
	if (
		buffer[0] === 0x89 &&
		buffer[1] === 0x50 &&
		buffer[2] === 0x4e &&
		buffer[3] === 0x47 &&
		buffer[4] === 0x0d &&
		buffer[5] === 0x0a &&
		buffer[6] === 0x1a &&
		buffer[7] === 0x0a
	) {
		if (buffer.length >= 24) {
			const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
			const width = view.getUint32(16, false);
			const height = view.getUint32(20, false);
			if (width > 0 && height > 0) {
				return { mimeType: "image/png", width, height };
			}
		}
	}

	// 2. GIF: GIF87a or GIF89a
	if (
		buffer.length >= 10 &&
		buffer[0] === 0x47 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x38 &&
		(buffer[4] === 0x37 || buffer[4] === 0x39) &&
		buffer[5] === 0x61
	) {
		const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
		const width = view.getUint16(6, true);
		const height = view.getUint16(8, true);
		if (width > 0 && height > 0) {
			return { mimeType: "image/gif", width, height };
		}
		return null;
	}

	// 3. JPEG: FF D8 FF
	if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
		let offset = 2;
		while (offset < buffer.length - 8) {
			if (buffer[offset] !== 0xff) {
				offset++;
				continue;
			}
			const marker = buffer[offset + 1];
			// SOF0 (0xC0), SOF1 (0xC1), SOF2 (0xC2) contain width/height
			if (marker === 0xc0 || marker === 0xc1 || marker === 0xc2) {
				const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
				const height = view.getUint16(offset + 5, false);
				const width = view.getUint16(offset + 7, false);
				if (width > 0 && height > 0) {
					return { mimeType: "image/jpeg", width, height };
				}
				break;
			}
			const len = (buffer[offset + 2] << 8) | buffer[offset + 3];
			if (len < 2) break;
			offset += 2 + len;
		}
		return null;
	}

	// 4. WebP: RIFF .... WEBP
	if (
		buffer.length >= 16 &&
		buffer[0] === 0x52 &&
		buffer[1] === 0x49 &&
		buffer[2] === 0x46 &&
		buffer[3] === 0x46 &&
		buffer[8] === 0x57 &&
		buffer[9] === 0x45 &&
		buffer[10] === 0x42 &&
		buffer[11] === 0x50
	) {
		const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
		// VP8 (lossy)
		if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x20) {
			if (buffer.length >= 30) {
				const width = view.getUint16(26, true) & 0x3fff;
				const height = view.getUint16(28, true) & 0x3fff;
				if (width > 0 && height > 0) {
					return { mimeType: "image/webp", width, height };
				}
			}
			return null;
		}
		// VP8L (lossless)
		if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x4c) {
			if (buffer.length >= 25) {
				const b1 = buffer[21];
				const b2 = buffer[22];
				const b3 = buffer[23];
				const b4 = buffer[24];
				const width = 1 + (((b2 & 0x3f) << 8) | b1);
				const height = 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6));
				if (width > 0 && height > 0) {
					return { mimeType: "image/webp", width, height };
				}
			}
			return null;
		}
		// VP8X (extended)
		if (buffer[12] === 0x56 && buffer[13] === 0x50 && buffer[14] === 0x38 && buffer[15] === 0x58) {
			if (buffer.length >= 30) {
				const width = 1 + (buffer[24] | (buffer[25] << 8) | (buffer[26] << 16));
				const height = 1 + (buffer[27] | (buffer[28] << 8) | (buffer[29] << 16));
				if (width > 0 && height > 0) {
					return { mimeType: "image/webp", width, height };
				}
			}
			return null;
		}
		return null;
	}

	// 5. AVIF: .... ftypavif or ftypavis
	if (
		buffer.length >= 12 &&
		buffer[4] === 0x66 &&
		buffer[5] === 0x74 &&
		buffer[6] === 0x79 &&
		buffer[7] === 0x70 &&
		buffer[8] === 0x61 &&
		buffer[9] === 0x76 &&
		buffer[10] === 0x69 &&
		(buffer[11] === 0x66 || buffer[11] === 0x73)
	) {
		for (let i = 12; i <= buffer.length - 16; i++) {
			if (buffer[i] === 0x69 && buffer[i + 1] === 0x73 && buffer[i + 2] === 0x70 && buffer[i + 3] === 0x65) {
				const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
				const width = view.getUint32(i + 8, false);
				const height = view.getUint32(i + 12, false);
				if (width > 0 && height > 0 && width < 65536 && height < 65536) {
					return { mimeType: "image/avif", width, height };
				}
			}
		}
		return null;
	}

	return null;
}
