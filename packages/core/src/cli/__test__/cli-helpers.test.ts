import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseJsonc, resolveConfigPaths } from "../config-paths";
import { loadEnvFiles } from "../env";
import { contentRewrite, migrate, runCli } from "../index";

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

	it("finds the site config from tsconfig `paths` (with comments and trailing commas), else checks common locations", () => {
		expect(parseJsonc('{ // a\n "a": "x//y", /* b */ "c": [1,], }')).toEqual({ a: "x//y", c: [1] });
		const withPaths = tempDir({
			"tsconfig.json": '{ "compilerOptions": { "paths": { "@cms-config": ["./src/site.ts"] }, }, }',
			"src/site.ts": "",
			"cms.server.ts": "",
		});
		// The server file is a plain module that exports the instance, so it is never looked up through an alias.
		expect(resolveConfigPaths(withPaths, {}, {})).toEqual({ config: "src/site.ts", server: "cms.server.ts" });
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

	it("lists content:rewrite, which is a dry run unless --apply is given, and needs the app's config files", async () => {
		const out: string[] = [];
		const io = { cwd: tempDir({}), log: (m: string) => out.push(m), error: (m: string) => out.push(`E:${m}`) };
		await runCli(["help"], io);
		expect(out.at(-1)).toContain("content:rewrite");
		expect(out.at(-1)).toContain("--apply");
		expect(out.at(-1)).toContain("dry run");
		// Without the app's config files it stops before touching anything, as `migrate` does.
		expect(await runCli(["content:rewrite"], io)).toBe(1);
		expect(out.at(-1)).toContain("monti init");
		// An unknown option is refused rather than ignored.
		expect(await runCli(["content:rewrite", "--write"], io)).toBe(1);
		expect(out.at(-1)).toMatch(/^E:.*--write/);
	});
});

/** A server file that exports a stand-in for the CMS instance and records what the command did to it. */
const appWith = (body: string) => {
	const dir = tempDir({
		"cms.config.mjs": "export default {};\n",
		"cms.server.mjs": `export const calls = [];\n${body}\n`,
	});
	return {
		dir,
		options: { cwd: dir, envFiles: [], config: "cms.config.mjs", server: "cms.server.mjs", log: () => undefined },
	};
};

describe("monti commands run against the instance the server file exports", () => {
	it("`migrate` migrates through the instance, then closes it", async () => {
		const { dir, options } = appWith(
			`export const cms = {
				migrate: async ({ log }) => { calls.push("migrate"); log("migrating"); },
				rewrite: async () => {},
				close: async () => { calls.push("close"); },
			};`,
		);
		const logs: string[] = [];
		expect(await migrate({ ...options, log: (message) => logs.push(message) })).toBe(true);
		const { calls } = await import(pathToFileURL(path.join(dir, "cms.server.mjs")).href);
		expect(calls).toEqual(["migrate", "close"]);
		expect(logs).toContain("migrating");
	});

	it("a failing migration reports failure and still closes the connection", async () => {
		const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
		const { dir, options } = appWith(
			`export const cms = {
				migrate: async () => { throw new Error("no database"); },
				rewrite: async () => {},
				close: async () => { calls.push("close"); },
			};`,
		);
		expect(await migrate(options)).toBe(false);
		const { calls } = await import(pathToFileURL(path.join(dir, "cms.server.mjs")).href);
		expect(calls).toEqual(["close"]);
		expect(error).toHaveBeenCalledWith("Migration failed:", expect.any(Error));
		error.mockRestore();
	});

	it("`content:rewrite` passes `apply` to the instance (a dry run without it) and closes it", async () => {
		const { dir, options } = appWith(
			`export const cms = {
				migrate: async () => {},
				rewrite: async ({ apply }) => { calls.push(apply ? "apply" : "dry"); },
				close: async () => { calls.push("close"); },
			};`,
		);
		expect(await contentRewrite(options)).toBe(true);
		expect(await contentRewrite({ ...options, apply: true })).toBe(true);
		const { calls } = await import(pathToFileURL(path.join(dir, "cms.server.mjs")).href);
		expect(calls).toEqual(["dry", "close", "apply", "close"]);
	});

	it("a server file that does not export an instance is refused with the shape to use", async () => {
		const { options } = appWith("export default { database: {}, auth: {} };");
		await expect(migrate(options)).rejects.toThrow(/must export the CMS instance.*createCms/);
	});
});
