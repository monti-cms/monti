import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { dbMigrate } from "../index";

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

/** A config file that exports a stand-in for the CMS instance and records what the command did to it. */
const appWith = (body: string) => {
	const dir = tempDir({
		"monti.config.mjs": `export const calls = [];\n${body}\n`,
	});
	return {
		dir,
		options: { cwd: dir, envFiles: [], config: "monti.config.mjs", log: () => undefined, error: () => undefined },
	};
};

describe("monti commands run against the instance the config file exports", () => {
	it("CLI-C1 a config file that does not export an instance is refused with the shape to use", async () => {
		const { options } = appWith("export default { database: {}, auth: {} };");
		await expect(dbMigrate(options)).rejects.toThrow(/must export the CMS instance.*defineConfig/);
	});
});
