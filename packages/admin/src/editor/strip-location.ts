/**
 * Removes the location (GPS) tags from an image file, without re-encoding it. Only the GPS data goes: the GPS block of the Exif data (and the entry
 * that points at it), and the GPS properties of an XMP packet. Rotation, camera data and every pixel stay, and the file keeps its size: what is removed
 * is zeroed (a GPS block) or blanked with spaces (XMP) in place, so nothing after it moves.
 *
 * JPEG (an Exif or XMP segment), PNG (an `eXIf` chunk or an XMP `iTXt` chunk; their checksums are written again) and WebP (an `EXIF` or `XMP ` chunk).
 * Any other file is returned as it is.
 */

/** The size in bytes of each Exif value type (BYTE, ASCII, SHORT, LONG, RATIONAL, SBYTE, UNDEFINED, SSHORT, SLONG, SRATIONAL, FLOAT, DOUBLE). */
const TIFF_TYPE_SIZE: Record<number, number> = {
	1: 1,
	2: 1,
	3: 2,
	4: 4,
	5: 8,
	6: 1,
	7: 1,
	8: 2,
	9: 4,
	10: 8,
	11: 4,
	12: 8,
};
const GPS_INFO_TAG = 0x8825;
const ENTRY = 12;

const ascii = (bytes: Uint8Array, at: number, text: string) =>
	text.length + at <= bytes.length && [...text].every((char, index) => bytes[at + index] === char.charCodeAt(0));

/** Removes the GPS block of the TIFF structure in `bytes[start, end)`. Returns whether anything changed. */
function stripTiff(bytes: Uint8Array, start: number, end: number): boolean {
	if (end - start < 8) return false;
	const little = ascii(bytes, start, "II");
	if (!little && !ascii(bytes, start, "MM")) return false;
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	const u16 = (at: number) => view.getUint16(at, little);
	const u32 = (at: number) => view.getUint32(at, little);
	if (u16(start + 2) !== 42) return false;
	const inside = (at: number, size: number) => at >= start && at + size <= end;

	const ifd0 = start + u32(start + 4);
	if (!inside(ifd0, 2)) return false;
	const count = u16(ifd0);
	const entriesEnd = ifd0 + 2 + count * ENTRY;
	if (!inside(ifd0, 2 + count * ENTRY + 4)) return false;

	for (let index = 0; index < count; index += 1) {
		const entry = ifd0 + 2 + index * ENTRY;
		if (u16(entry) !== GPS_INFO_TAG) continue;

		// The GPS block: zero its values that live outside the entries, then the entries.
		const gps = start + u32(entry + 8);
		if (inside(gps, 2)) {
			const gpsCount = u16(gps);
			if (inside(gps, 2 + gpsCount * ENTRY + 4)) {
				for (let at = 0; at < gpsCount; at += 1) {
					const tag = gps + 2 + at * ENTRY;
					const size = (TIFF_TYPE_SIZE[u16(tag + 2)] ?? 0) * u32(tag + 4);
					const value = start + u32(tag + 8);
					if (size > 4 && inside(value, size)) bytes.fill(0, value, value + size);
				}
				bytes.fill(0, gps, gps + 2 + gpsCount * ENTRY + 4);
			}
		}

		// The entry that points at it: the entries after it move up and the next-IFD pointer follows them; the freed 12 bytes are zero.
		bytes.copyWithin(entry, entry + ENTRY, entriesEnd + 4);
		bytes.fill(0, entriesEnd + 4 - ENTRY, entriesEnd + 4);
		view.setUint16(ifd0, count - 1, little);
		return true;
	}
	return false;
}

const XMP_GPS_ATTRIBUTE = /\s[A-Za-z0-9]+:GPS[A-Za-z]*\s*=\s*(?:"[^"]*"|'[^']*')/g;
const XMP_GPS_ELEMENT =
	/<([A-Za-z0-9]+:GPS[A-Za-z]*)(?:\s[^>]*)?>[\s\S]*?<\/\1>|<[A-Za-z0-9]+:GPS[A-Za-z]*(?:\s[^>]*)?\/>/g;

/** Blanks the GPS properties of an XMP packet in `bytes[start, end)` with spaces, so the packet keeps its length. */
function stripXmp(bytes: Uint8Array, start: number, end: number): boolean {
	let text = "";
	for (let at = start; at < end; at += 1) text += String.fromCharCode(bytes[at] as number);
	const blank = (match: string) => " ".repeat(match.length);
	const cleaned = text.replace(XMP_GPS_ATTRIBUTE, blank).replace(XMP_GPS_ELEMENT, blank);
	if (cleaned === text) return false;
	for (let at = 0; at < cleaned.length; at += 1) bytes[start + at] = cleaned.charCodeAt(at);
	return true;
}

const XMP_JPEG_HEADER = "http://ns.adobe.com/xap/1.0/\0";

function stripJpeg(bytes: Uint8Array): boolean {
	let changed = false;
	let at = 2;
	while (at + 4 <= bytes.length && bytes[at] === 0xff) {
		const marker = bytes[at + 1] as number;
		if (marker === 0xd9 || marker === 0xda) break;
		if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8) || marker === 0xff) {
			at += marker === 0xff ? 1 : 2;
			continue;
		}
		const length = ((bytes[at + 2] as number) << 8) | (bytes[at + 3] as number);
		const end = Math.min(at + 2 + length, bytes.length);
		if (marker === 0xe1) {
			if (ascii(bytes, at + 4, "Exif\0\0")) changed = stripTiff(bytes, at + 10, end) || changed;
			else if (ascii(bytes, at + 4, XMP_JPEG_HEADER))
				changed = stripXmp(bytes, at + 4 + XMP_JPEG_HEADER.length, end) || changed;
		}
		at = end;
	}
	return changed;
}

let crcTable: Uint32Array | undefined;
function crc32(bytes: Uint8Array, start: number, end: number): number {
	if (!crcTable) {
		crcTable = new Uint32Array(256);
		for (let n = 0; n < 256; n += 1) {
			let c = n;
			for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
			crcTable[n] = c >>> 0;
		}
	}
	let c = 0xffffffff;
	for (let at = start; at < end; at += 1) c = (crcTable[(c ^ (bytes[at] as number)) & 0xff] as number) ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}

function stripPng(bytes: Uint8Array): boolean {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let changed = false;
	let at = 8;
	while (at + 12 <= bytes.length) {
		const length = view.getUint32(at);
		const data = at + 8;
		const end = data + length;
		if (end + 4 > bytes.length) break;
		let touched = false;
		if (ascii(bytes, at + 4, "eXIf")) touched = stripTiff(bytes, data, end);
		else if (ascii(bytes, at + 4, "iTXt") && ascii(bytes, data, "XML:com.adobe.xmp\0")) {
			// keyword, compression flag, method, language tag, translated keyword, then the text. Only an uncompressed packet can be read.
			const keyword = "XML:com.adobe.xmp\0".length;
			if (bytes[data + keyword] === 0) {
				let text = data + keyword + 2;
				for (let nulls = 0; nulls < 2 && text < end; text += 1) if (bytes[text] === 0) nulls += 1;
				touched = stripXmp(bytes, text, end);
			}
		}
		if (touched) {
			view.setUint32(end, crc32(bytes, at + 4, end));
			changed = true;
		}
		at = end + 4;
	}
	return changed;
}

function stripWebp(bytes: Uint8Array): boolean {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	let changed = false;
	let at = 12;
	while (at + 8 <= bytes.length) {
		const length = view.getUint32(at + 4, true);
		const data = at + 8;
		const end = Math.min(data + length, bytes.length);
		if (ascii(bytes, at, "EXIF")) {
			// Some writers put the `Exif\0\0` mark in front of the TIFF data, as a JPEG does.
			changed = stripTiff(bytes, ascii(bytes, data, "Exif\0\0") ? data + 6 : data, end) || changed;
		} else if (ascii(bytes, at, "XMP ")) {
			changed = stripXmp(bytes, data, end) || changed;
		}
		at = data + length + (length % 2);
	}
	return changed;
}

/** The file type read from its first bytes (the name and the declared type are not trusted). */
const kindOf = (bytes: Uint8Array): "jpeg" | "png" | "webp" | null => {
	if (bytes[0] === 0xff && bytes[1] === 0xd8) return "jpeg";
	if (ascii(bytes, 1, "PNG")) return "png";
	if (ascii(bytes, 0, "RIFF") && ascii(bytes, 8, "WEBP")) return "webp";
	return null;
};

/** The bytes of a file. `Blob.arrayBuffer` where it exists, a `FileReader` where it does not (older test and browser environments). */
export const readBytes = (blob: Blob): Promise<ArrayBuffer> =>
	typeof blob.arrayBuffer === "function"
		? blob.arrayBuffer()
		: new Promise((resolve, reject) => {
				const reader = new FileReader();
				reader.onload = () => resolve(reader.result as ArrayBuffer);
				reader.onerror = () => reject(reader.error);
				reader.readAsArrayBuffer(blob);
			});

/** The bytes of an image without its location data, or `null` when it had none (or is not a JPEG, PNG or WebP). The input is not changed. */
export function withoutLocation(bytes: Uint8Array): Uint8Array | null {
	const kind = kindOf(bytes);
	if (!kind) return null;
	const copy = bytes.slice();
	const changed = kind === "jpeg" ? stripJpeg(copy) : kind === "png" ? stripPng(copy) : stripWebp(copy);
	return changed ? copy : null;
}

/** The file without its location data; the same file when it had none, so nothing is copied for the common case. */
export async function stripLocation(file: File): Promise<File> {
	const bytes = new Uint8Array(await readBytes(file));
	const cleaned = withoutLocation(bytes);
	return cleaned
		? new File([cleaned.buffer as ArrayBuffer], file.name, { type: file.type, lastModified: file.lastModified })
		: file;
}
