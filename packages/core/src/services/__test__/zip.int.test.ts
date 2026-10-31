import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { createZipArchive } from "../zip";

const encoder = new TextEncoder();

const hasUnzip = (() => {
	try {
		execFileSync("unzip", ["-v"], { stdio: "ignore" });
		return true;
	} catch {
		return false;
	}
})();

describe("zip archive writer", () => {
	it.skipIf(!hasUnzip)("DATA-B1 is readable by the system unzip binary", () => {
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
