import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseJsonc, resolveServerPath } from "../config-paths";
import { loadEnvFiles } from "../env";
import { migrate, runCli } from "../index";

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

	it("reads tsconfig with comments and trailing commas", () => {
		expect(parseJsonc('{ // a\n "a": "x//y", /* b */ "c": [1,], }')).toEqual({ a: "x//y", c: [1] });
		expect(parseJsonc("{ nope")).toBeUndefined();
	});

	it("finds the server file from `--server`, `CMS_SERVER_PATH`, else common locations", () => {
		const root = tempDir({ "cms.server.ts": "", "src/cms.server.ts": "", "custom/server.ts": "" });
		// The root file wins over the one in `src`.
		expect(resolveServerPath(root, undefined, {})).toBe("cms.server.ts");
		const inSrc = tempDir({ "src/cms.server.ts": "" });
		expect(resolveServerPath(inSrc, undefined, {})).toBe("src/cms.server.ts");
		// The chosen value beats the environment variable, which beats the common locations.
		expect(resolveServerPath(root, "custom/server.ts", { CMS_SERVER_PATH: "src/cms.server.ts" })).toBe(
			"custom/server.ts",
		);
		expect(resolveServerPath(root, undefined, { CMS_SERVER_PATH: "src/cms.server.ts" })).toBe("src/cms.server.ts");
		expect(() => resolveServerPath(tempDir({}), undefined, {})).toThrow(/monti init/);
		expect(() => resolveServerPath(root, "nope.ts", {})).toThrow(/not found: nope.ts/);
		expect(() => resolveServerPath(root, undefined, { CMS_SERVER_PATH: "nope.ts" })).toThrow(/not found: nope.ts/);
	});

	it("help and unknown commands", async () => {
		const out: string[] = [];
		const io = { cwd: tempDir({}), log: (m: string) => out.push(m), error: (m: string) => out.push(`E:${m}`) };
		expect(await runCli([], io)).toBe(0);
		expect(out.at(-1)).toContain("Usage: monti <command>");
		expect(out.at(-1)).toContain("--locale <code>");
		expect(out.at(-1)).toContain("--time-zone <tz>");
		// The site config is imported by the server file, so no command takes it.
		expect(out.at(-1)).not.toContain("--config");
		// The removed command is not advertised.
		expect(out.at(-1)).not.toContain("content:rewrite");
		expect(await runCli(["deploy"], io)).toBe(1);
		expect(out.at(-1)).toContain("E:Unknown command: deploy");
		expect(await runCli(["init"], io)).toBe(1); // no package.json
		expect(out.at(-1)).toContain("E:package.json not found");
	});
});

/** A server file that exports a stand-in for the CMS instance and records what the command did to it. */
const appWith = (body: string) => {
	const dir = tempDir({
		"cms.server.mjs": `export const calls = [];\n${body}\n`,
	});
	return {
		dir,
		options: { cwd: dir, envFiles: [], server: "cms.server.mjs", log: () => undefined },
	};
};

describe("monti commands run against the instance the server file exports", () => {
	it("`migrate` migrates through the instance, then closes it", async () => {
		const { dir, options } = appWith(
			`export const cms = {
				migrate: async ({ log }) => { calls.push("migrate"); log("migrating"); },
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
				close: async () => { calls.push("close"); },
			};`,
		);
		expect(await migrate(options)).toBe(false);
		const { calls } = await import(pathToFileURL(path.join(dir, "cms.server.mjs")).href);
		expect(calls).toEqual(["close"]);
		expect(error).toHaveBeenCalledWith("Migration failed:", expect.any(Error));
		error.mockRestore();
	});

	it("a server file that does not export an instance is refused with the shape to use", async () => {
		const { options } = appWith("export default { database: {}, auth: {} };");
		await expect(migrate(options)).rejects.toThrow(/must export the CMS instance.*createCms/);
	});
});
