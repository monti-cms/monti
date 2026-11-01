import { describe, expect, it } from "vitest";
import { crc32, createZipArchive, readZipArchive } from "../zip";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe("zip archive writer", () => {
	it("DATA-B1 round-trips text and binary entries through the reader", () => {
		const binary = new Uint8Array([0, 1, 2, 250, 255, 128, 0, 66]);
		const archive = createZipArchive([
			{ path: "manifest.json", data: encoder.encode('{"a":1}') },
			{ path: "entries/memo/x/working.mdx", data: binary },
		]);

		const entries = readZipArchive(archive);
		expect(entries.map((entry) => entry.path)).toEqual(["manifest.json", "entries/memo/x/working.mdx"]);
		expect(decoder.decode(entries[0].data)).toBe('{"a":1}');
		expect(Array.from(entries[1].data)).toEqual(Array.from(binary));
	});

	it("DATA-B2 is deterministic for identical input and stable mtime", () => {
		const input = [{ path: "a.txt", data: encoder.encode("hello") }];
		const first = createZipArchive(input);
		const second = createZipArchive(input);
		expect(Array.from(first)).toEqual(Array.from(second));
	});

	it("DATA-B1 produces a readable empty archive", () => {
		const archive = createZipArchive([]);
		expect(readZipArchive(archive)).toEqual([]);
	});

	it("DATA-B2 changes bytes when the fixed mtime changes", () => {
		const input = [{ path: "a.txt", data: encoder.encode("hello") }];
		const base = createZipArchive(input);
		const other = createZipArchive(input, { modifiedAt: new Date(Date.UTC(2020, 4, 5, 6, 7, 8)) });
		expect(Array.from(base)).not.toEqual(Array.from(other));
		expect(readZipArchive(other)[0]?.path).toBe("a.txt");
	});

	it("DATA-B1 computes the standard CRC32 value", () => {
		expect(crc32(encoder.encode("123456789"))).toBe(0xcbf43926);
	});
});

describe("reading a zip", () => {
	it("DATA-I9 stops at the size the entries inflate to, so a small zip cannot expand without limit", () => {
		const zip = createZipArchive([{ path: "big.txt", data: new Uint8Array(4 * 1024 * 1024) }]);
		expect(zip.byteLength).toBeLessThan(64 * 1024);
		expect(() => readZipArchive(zip, { maxTotalBytes: 1024 * 1024 })).toThrow(/limit/);
		expect(readZipArchive(zip, { maxTotalBytes: 8 * 1024 * 1024 })[0]?.data.byteLength).toBe(4 * 1024 * 1024);
	});
});
