import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { parseJsonc, resolveConfigPaths } from "../config-paths";
import { loadEnvFiles } from "../env";
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
	it("env files do not override existing values (shell values and earlier files win)", () => {
		const dir = tempDir({ ".env.local": "A=local\nB=local\n", ".env": "B=env\nC=env\n" });
		const env: Record<string, string | undefined> = { A: "shell" };
		expect(loadEnvFiles(dir, undefined, env)).toEqual([".env.local", ".env"]);
		expect(env).toEqual({ A: "shell", B: "local", C: "env" });
		expect(loadEnvFiles(dir, [], {})).toEqual([]);
		expect(() => loadEnvFiles(dir, [".env.missing"], {})).toThrow(/not found/);
	});

	it("finds config files from tsconfig `paths` (with comments and trailing commas), else checks common locations", () => {
		expect(parseJsonc('{ // a\n "a": "x//y", /* b */ "c": [1,], }')).toEqual({ a: "x//y", c: [1] });
		const withPaths = tempDir({
			"tsconfig.json":
				'{ "compilerOptions": { "paths": { "@cms-config": ["./src/site.ts"], "@cms-server": ["./src/server.ts"] }, }, }',
			"src/site.ts": "",
			"src/server.ts": "",
		});
		expect(resolveConfigPaths(withPaths, {}, {})).toEqual({ config: "src/site.ts", server: "src/server.ts" });
		const plain = tempDir({ "src/cms.config.ts": "", "src/cms.server.ts": "" });
		expect(resolveConfigPaths(plain, {}, {})).toEqual({ config: "src/cms.config.ts", server: "src/cms.server.ts" });
		expect(
			resolveConfigPaths(plain, { config: "src/cms.config.ts" }, { CMS_SERVER_PATH: "src/cms.server.ts" }),
		).toEqual({ config: "src/cms.config.ts", server: "src/cms.server.ts" });
		expect(() => resolveConfigPaths(tempDir({}), {}, {})).toThrow(/monti init/);
		expect(() => resolveConfigPaths(plain, { config: "nope.ts" }, {})).toThrow(/not found: nope.ts/);
	});

	it("help and unknown commands", async () => {
		const out: string[] = [];
		const io = { cwd: tempDir({}), log: (m: string) => out.push(m), error: (m: string) => out.push(`E:${m}`) };
		expect(await runCli([], io)).toBe(0);
		expect(out.at(-1)).toContain("Usage: monti <command>");
		expect(out.at(-1)).toContain("--locale <code>");
		expect(out.at(-1)).toContain("--time-zone <tz>");
		expect(await runCli(["deploy"], io)).toBe(1);
		expect(out.at(-1)).toContain("E:Unknown command: deploy");
		expect(await runCli(["init"], io)).toBe(1); // no package.json
		expect(out.at(-1)).toContain("E:package.json not found");
	});
});
