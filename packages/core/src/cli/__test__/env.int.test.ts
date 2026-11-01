import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { loadEnvFiles } from "../env";

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
	it("DB-C2 env files do not override existing values (shell values and earlier files win)", () => {
		const dir = tempDir({ ".env.local": "A=local\nB=local\n", ".env": "B=env\nC=env\n" });
		const env: Record<string, string | undefined> = { A: "shell" };
		expect(loadEnvFiles(dir, undefined, env)).toEqual([".env.local", ".env"]);
		expect(env).toEqual({ A: "shell", B: "local", C: "env" });
		expect(loadEnvFiles(dir, [], {})).toEqual([]);
		expect(() => loadEnvFiles(dir, [".env.missing"], {})).toThrow(/\.env\.missing.*does not exist.*Fix:/);
	});
});
