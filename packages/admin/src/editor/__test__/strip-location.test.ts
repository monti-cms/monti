import { describe, expect, it } from "vitest";
import { stripLocation, withoutLocation } from "../strip-location";

// The fixtures are small hand-built files: an Exif block with a make, an orientation and a GPS block, put in a JPEG, a PNG and a WebP.

const MAKE = "Acme";
const ORIENTATION = 6;
const XMP_WITH_GPS =
	'<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF><rdf:Description exif:GPSLatitude="37,33.5N" exif:GPSLongitude="126,58.7E" tiff:Make="Acme"><exif:GPSAltitude>12/1</exif:GPSAltitude></rdf:Description></rdf:RDF></x:xmpmeta>';

interface Tiff {
	bytes: Uint8Array;
	/** Where the three parts of the file are: IFD0, the GPS block and the GPS values stored outside it. */
	ifd0: number;
	gps: number;
	gpsValues: number;
}

/** A TIFF block (Exif): IFD0 with Make, Orientation and the GPS pointer; the GPS block has a latitude ref, a latitude (three rationals) and a longitude ref. */
function buildTiff(little: boolean): Tiff {
	const bytes = new Uint8Array(200);
	const view = new DataView(bytes.buffer);
	const u16 = (at: number, value: number) => view.setUint16(at, value, little);
	const u32 = (at: number, value: number) => view.setUint32(at, value, little);
	bytes.set([...(little ? "II" : "MM")].map((char) => char.charCodeAt(0)));
	u16(2, 42);
	u32(4, 8);
	const ifd0 = 8;
	const makeAt = 60;
	const gps = 80;
	const gpsValues = 120;
	u16(ifd0, 3);
	// Make (ASCII, 5 bytes, stored outside), Orientation (SHORT), GPS pointer (LONG).
	u16(ifd0 + 2, 0x010f);
	u16(ifd0 + 4, 2);
	u32(ifd0 + 6, MAKE.length + 1);
	u32(ifd0 + 10, makeAt);
	u16(ifd0 + 14, 0x0112);
	u16(ifd0 + 16, 3);
	u32(ifd0 + 18, 1);
	u16(ifd0 + 22, ORIENTATION);
	u16(ifd0 + 26, 0x8825);
	u16(ifd0 + 28, 4);
	u32(ifd0 + 30, 1);
	u32(ifd0 + 34, gps);
	u32(ifd0 + 38, 0);
	bytes.set(
		[...MAKE].map((char) => char.charCodeAt(0)),
		makeAt,
	);
	u16(gps, 3);
	u16(gps + 2, 1);
	u16(gps + 4, 2);
	u32(gps + 6, 2);
	bytes.set(["N".charCodeAt(0)], gps + 10);
	u16(gps + 14, 2);
	u16(gps + 16, 5);
	u32(gps + 18, 3);
	u32(gps + 22, gpsValues);
	u16(gps + 26, 3);
	u16(gps + 28, 2);
	u32(gps + 30, 2);
	bytes.set(["E".charCodeAt(0)], gps + 34);
	u32(gps + 38, 0);
	for (let index = 0; index < 24; index += 1) bytes[gpsValues + index] = 0x40 + index;
	return { bytes, ifd0, gps, gpsValues };
}

const at = (bytes: Uint8Array, text: string) => String.fromCharCode(...bytes).indexOf(text);
const ascii = (text: string) => [...text].map((char) => char.charCodeAt(0));
const concat = (...parts: ArrayLike<number>[]) => Uint8Array.from(parts.flatMap((part) => [...Array.from(part)]));
const be32 = (value: number) => [(value >>> 24) & 255, (value >>> 16) & 255, (value >>> 8) & 255, value & 255];
const le32 = (value: number) => be32(value).reverse();

function jpeg(...segments: { marker: number; data: ArrayLike<number> }[]): Uint8Array {
	return concat(
		[0xff, 0xd8],
		...segments.flatMap(({ marker, data }) => [[0xff, marker, (data.length + 2) >> 8, (data.length + 2) & 255], data]),
		[0xff, 0xda, 0x00, 0x02, 1, 2, 3, 4],
		[0xff, 0xd9],
	);
}

let table: number[] | undefined;
function crc(bytes: ArrayLike<number>): number {
	if (!table) {
		table = [];
		for (let n = 0; n < 256; n += 1) {
			let c = n;
			for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
			table.push(c >>> 0);
		}
	}
	let c = 0xffffffff;
	for (const byte of Array.from(bytes)) c = (table[(c ^ byte) & 255] as number) ^ (c >>> 8);
	return (c ^ 0xffffffff) >>> 0;
}
const pngChunk = (type: string, data: ArrayLike<number>) => {
	const body = concat(ascii(type), data);
	return concat(be32(data.length), body, be32(crc(body)));
};
const png = (...chunks: Uint8Array[]) =>
	concat(
		[0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
		pngChunk("IHDR", new Uint8Array(13)),
		...chunks,
		pngChunk("IDAT", [1, 2, 3, 4]),
		pngChunk("IEND", []),
	);

const webpChunk = (type: string, data: ArrayLike<number>) =>
	concat(ascii(type), le32(data.length), data, data.length % 2 ? [0] : []);
const webp = (...chunks: Uint8Array[]) => {
	const body = concat(ascii("WEBP"), webpChunk("VP8X", new Uint8Array(10)), ...chunks);
	return concat(ascii("RIFF"), le32(body.length), body);
};

/** Reads the fixture's Exif back: the tags in IFD0, the orientation and the make. */
function readTiff(bytes: Uint8Array, start: number) {
	const view = new DataView(bytes.buffer, bytes.byteOffset);
	const little = bytes[start] === 0x49;
	const ifd0 = start + view.getUint32(start + 4, little);
	const count = view.getUint16(ifd0, little);
	const tags: number[] = [];
	let orientation: number | null = null;
	let make = "";
	for (let index = 0; index < count; index += 1) {
		const entry = ifd0 + 2 + index * 12;
		const tag = view.getUint16(entry, little);
		tags.push(tag);
		if (tag === 0x0112) orientation = view.getUint16(entry + 8, little);
		if (tag === 0x010f) {
			const at = start + view.getUint32(entry + 8, little);
			make = String.fromCharCode(...bytes.slice(at, at + view.getUint32(entry + 4, little) - 1));
		}
	}
	return { tags, orientation, make, next: view.getUint32(ifd0 + 2 + count * 12, little) };
}

/** Every byte that differs between two files must be inside one of the allowed ranges. */
function onlyChangedWithin(before: Uint8Array, after: Uint8Array, allowed: [number, number][]) {
	expect(after.length).toBe(before.length);
	for (let index = 0; index < before.length; index += 1) {
		if (before[index] === after[index]) continue;
		expect(
			allowed.some(([from, to]) => index >= from && index < to),
			`byte ${index} changed outside the GPS data`,
		).toBe(true);
	}
}

describe.each([
	["little-endian", true],
	["big-endian", false],
])("Exif GPS removal (%s)", (_name, little) => {
	const tiff = buildTiff(little);
	const exif = tiff.bytes;
	const file = jpeg({ marker: 0xe0, data: ascii("JFIF\0") }, { marker: 0xe1, data: concat(ascii("Exif\0\0"), exif) });
	const tiffStart = at(file, "Exif\0\0") + 6;

	it("MEDIA-U4 removes the GPS block and its entry from a JPEG, and keeps the rotation, the camera and the size", () => {
		const cleaned = withoutLocation(file);
		expect(cleaned).not.toBeNull();
		const after = cleaned as Uint8Array;
		const read = readTiff(after, tiffStart);
		expect(read.tags).toEqual([0x010f, 0x0112]);
		expect(read.orientation).toBe(ORIENTATION);
		expect(read.make).toBe(MAKE);
		expect(read.next).toBe(0);
		// The GPS values are gone, not only unlisted.
		expect(
			[...after.slice(tiffStart + tiff.gpsValues, tiffStart + tiff.gpsValues + 24)].every((byte) => byte === 0),
		).toBe(true);
		expect([...after.slice(tiffStart + tiff.gps, tiffStart + tiff.gps + 42)].every((byte) => byte === 0)).toBe(true);
		onlyChangedWithin(file, after, [
			[tiffStart + tiff.ifd0, tiffStart + tiff.ifd0 + 42],
			[tiffStart + tiff.gps, tiffStart + tiff.gps + 42],
			[tiffStart + tiff.gpsValues, tiffStart + tiff.gpsValues + 24],
		]);
	});
});

describe("other containers", () => {
	it("MEDIA-U4 cleans the eXIf chunk of a PNG and writes its checksum again", () => {
		const tiff = buildTiff(true);
		const file = png(pngChunk("eXIf", tiff.bytes));
		const after = withoutLocation(file) as Uint8Array;
		expect(after).not.toBeNull();
		const chunkAt = file.findIndex((_byte, index) => String.fromCharCode(...file.slice(index, index + 4)) === "eXIf");
		const data = chunkAt + 4;
		const read = readTiff(after, data);
		expect(read.tags).toEqual([0x010f, 0x0112]);
		expect(read.orientation).toBe(ORIENTATION);
		const stored = new DataView(after.buffer).getUint32(data + tiff.bytes.length);
		expect(stored).toBe(crc(after.slice(chunkAt, data + tiff.bytes.length)));
		onlyChangedWithin(file, after, [
			[data + tiff.ifd0, data + tiff.ifd0 + 42],
			[data + tiff.gps, data + tiff.gps + 42],
			[data + tiff.gpsValues, data + tiff.gpsValues + 24],
			[data + tiff.bytes.length, data + tiff.bytes.length + 4],
		]);
	});

	it("MEDIA-U4 cleans the EXIF chunk of a WebP, with or without the Exif mark in front", () => {
		for (const mark of [[], ascii("Exif\0\0")]) {
			const tiff = buildTiff(true);
			const file = webp(webpChunk("EXIF", concat(mark, tiff.bytes)));
			const after = withoutLocation(file) as Uint8Array;
			const data =
				file.findIndex((_byte, index) => String.fromCharCode(...file.slice(index, index + 4)) === "EXIF") +
				8 +
				mark.length;
			const read = readTiff(after, data);
			expect(read.tags).toEqual([0x010f, 0x0112]);
			expect(read.orientation).toBe(ORIENTATION);
			expect(after.length).toBe(file.length);
		}
	});

	it("MEDIA-U4 blanks the GPS properties of an XMP packet, in JPEG, PNG and WebP, and keeps the rest of it", () => {
		const packet = ascii(XMP_WITH_GPS);
		const keyword = ascii("XML:com.adobe.xmp\0");
		const files = [
			jpeg({ marker: 0xe1, data: concat(ascii("http://ns.adobe.com/xap/1.0/\0"), packet) }),
			png(pngChunk("iTXt", concat(keyword, [0, 0], [0], [0], packet))),
			webp(webpChunk("XMP ", packet)),
		];
		for (const file of files) {
			const after = withoutLocation(file) as Uint8Array;
			expect(after).not.toBeNull();
			const text = String.fromCharCode(...after);
			expect(text).not.toContain("GPS");
			expect(text).not.toContain("37,33.5N");
			expect(text).toContain('tiff:Make="Acme"');
			expect(text).toContain("<rdf:Description");
			expect(after.length).toBe(file.length);
		}
	});

	it("MEDIA-U4 returns null for files that are not JPEG, PNG or WebP, and for ones without Exif", () => {
		expect(withoutLocation(new Uint8Array([71, 73, 70, 56, 57, 97]))).toBeNull();
		expect(withoutLocation(jpeg({ marker: 0xe0, data: ascii("JFIF\0") }))).toBeNull();
		expect(withoutLocation(new Uint8Array())).toBeNull();
	});
});

describe("stripLocation", () => {});
