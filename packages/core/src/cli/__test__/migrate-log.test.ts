import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { writeMigrateLog } from "../db";

let dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
});

describe("the migrate log file", () => {
	it("goes to .monti/logs in the app folder, named by the time, with one line per row", () => {
		const dir = mkdtempSync(path.join(tmpdir(), "monti-log-"));
		dirs.push(dir);
		const file = writeMigrateLog(dir, ["row one", "row two"], new Date("2026-10-13T14:05:12.345Z"));
		expect(file).toBe(".monti/logs/migrate-2026-10-13T14-05-12.log");
		expect(readFileSync(path.join(dir, file), "utf8")).toBe("row one\nrow two\n");
		expect(existsSync(path.join(dir, ".monti/logs"))).toBe(true);
	});
});
