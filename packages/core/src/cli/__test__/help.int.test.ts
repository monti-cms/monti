import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { runCli } from "../index";

let dirs: string[] = [];
afterEach(() => {
	for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
	dirs = [];
});
const tempDir = (files: Record<string, string>) => {
	const dir = mkdtempSync(path.join(tmpdir(), "cms-cli-"));
	dirs.push(dir);
	for (const [file, content] of Object.entries(files)) {
		mkdirSync(path.dirname(path.join(dir, file)), { recursive: true });
		writeFileSync(path.join(dir, file), content);
	}
	return dir;
};

describe("monti command helpers", () => {
	it("CLI-H1 help and unknown commands", async () => {
		const out: string[] = [];
		const io = { cwd: tempDir({}), log: (m: string) => out.push(m), error: (m: string) => out.push(`E:${m}`) };
		expect(await runCli([], io)).toBe(0);
		expect(out.at(-1)).toContain("Usage: monti <command>");
		expect(out.at(-1)).toContain("--locale <code>");
		expect(out.at(-1)).toContain("--time-zone <tz>");
		// One config file: the commands that load the app take `--config`, and there is no separate server file any more.
		const migrateHelp = out.at(-1)?.split("  db:migrate")[1]?.split("  admin:reset-password")[0];
		expect(migrateHelp).toContain("--config <file>");
		expect(migrateHelp).not.toContain("--server");
		expect(out.at(-1)).toContain("schema:extract");
		// The removed command is not advertised.
		expect(out.at(-1)).not.toContain("content:rewrite");
		expect(await runCli(["deploy"], io)).toBe(1);
		expect(out.at(-1)).toContain("E:Unknown command: deploy");
		expect(await runCli(["init"], io)).toBe(1); // no package.json
		expect(out.at(-1)).toContain("E:package.json not found");
	});
});
