import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { crc32, createZipArchive, readZipArchive } from "../zip";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

const hasUnzip = (() => {
	try {
		execFileSync("unzip", ["-v"], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
})();

describe("zip archive writer", () => {
	it("round-trips text and binary entries through the reader", () => {
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

	it("is deterministic for identical input and stable mtime", () => {
		const input = [{ path: "a.txt", data: encoder.encode("hello") }];
		const first = createZipArchive(input);
		const second = createZipArchive(input);
		expect(Array.from(first)).toEqual(Array.from(second));
	});

	it("produces a readable empty archive", () => {
		const archive = createZipArchive([]);
		expect(readZipArchive(archive)).toEqual([]);
	});

	it("changes bytes when the fixed mtime changes", () => {
		const input = [{ path: "a.txt", data: encoder.encode("hello") }];
		const base = createZipArchive(input);
		const other = createZipArchive(input, { modifiedAt: new Date(Date.UTC(2020, 4, 5, 6, 7, 8)) });
		expect(Array.from(base)).not.toEqual(Array.from(other));
		expect(readZipArchive(other)[0]?.path).toBe("a.txt");
	});

	it("computes the standard CRC32 value", () => {
		expect(crc32(encoder.encode("123456789"))).toBe(0xcbf43926);
	});

	it.skipIf(!hasUnzip)("is readable by the system unzip binary", () => {
		const archive = createZipArchive([
			{ path: "manifest.json", data: encoder.encode('{"formatVersion":1}') },
			{ path: "entries/post/abc/published.mdx", data: encoder.encode("# 제목\n\n본문") },
		]);
		const dir = mkdtempSync(path.join(tmpdir(), "cms-zip-"));
		const file = path.join(dir, "archive.zip");
		try {
			writeFileSync(file, archive);
			const listing = execFileSync("unzip", ["-l", file], { encoding: "utf8" });
			expect(listing).toContain("manifest.json");
			expect(listing).toContain("entries/post/abc/published.mdx");
			const extracted = execFileSync("unzip", ["-p", file, "manifest.json"], { encoding: "utf8" });
			expect(extracted).toBe('{"formatVersion":1}');
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});
});
