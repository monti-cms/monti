import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseJsonc, resolveConfigPath } from "../config-paths";
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
		expect(() => loadEnvFiles(dir, [".env.missing"], {})).toThrow(/\.env\.missing.*does not exist.*Fix:/);
	});

	it("reads tsconfig with comments and trailing commas", () => {
		expect(parseJsonc('{ // a\n "a": "x//y", /* b */ "c": [1,], }')).toEqual({ a: "x//y", c: [1] });
		expect(parseJsonc("{ nope")).toBeUndefined();
	});

	it("finds monti.config.ts from `--config`, `MONTI_CONFIG_PATH`, else common locations", () => {
		const root = tempDir({ "monti.config.ts": "", "src/monti.config.ts": "", "custom/config.ts": "" });
		// The root file wins over the one in `src`.
		expect(resolveConfigPath(root, undefined, {})).toBe("monti.config.ts");
		const inSrc = tempDir({ "src/monti.config.ts": "" });
		expect(resolveConfigPath(inSrc, undefined, {})).toBe("src/monti.config.ts");
		// The chosen value beats the environment variable, which beats the common locations.
		expect(resolveConfigPath(root, "custom/config.ts", { MONTI_CONFIG_PATH: "src/monti.config.ts" })).toBe(
			"custom/config.ts",
		);
		expect(resolveConfigPath(root, undefined, { MONTI_CONFIG_PATH: "src/monti.config.ts" })).toBe(
			"src/monti.config.ts",
		);
		expect(() => resolveConfigPath(tempDir({}), undefined, {})).toThrow(/monti init/);
		expect(() => resolveConfigPath(root, "nope.ts", {})).toThrow(/nope\.ts.*does not exist.*--config.*Fix:/);
		expect(() => resolveConfigPath(root, undefined, { MONTI_CONFIG_PATH: "nope.ts" })).toThrow(
			/nope\.ts.*does not exist.*MONTI_CONFIG_PATH.*Fix:/,
		);
		// The old server file is not looked for any more.
		expect(() => resolveConfigPath(tempDir({ "cms.server.ts": "" }), undefined, {})).toThrow(/monti init/);
	});

	it("help and unknown commands", async () => {
		const out: string[] = [];
		const io = { cwd: tempDir({}), log: (m: string) => out.push(m), error: (m: string) => out.push(`E:${m}`) };
		expect(await runCli([], io)).toBe(0);
		expect(out.at(-1)).toContain("Usage: monti <command>");
		expect(out.at(-1)).toContain("--locale <code>");
		expect(out.at(-1)).toContain("--time-zone <tz>");
		// One config file: the commands that load the app take `--config`, and there is no separate server file any more.
		const migrateHelp = out.at(-1)?.split("  migrate")[1]?.split("  schema:types")[0];
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

/** A config file that exports a stand-in for the CMS instance and records what the command did to it. */
const appWith = (body: string) => {
	const dir = tempDir({
		"monti.config.mjs": `export const calls = [];\n${body}\n`,
	});
	return {
		dir,
		options: { cwd: dir, envFiles: [], config: "monti.config.mjs", log: () => undefined },
	};
};

describe("monti commands run against the instance the config file exports", () => {
	it("`migrate` migrates through the instance, then closes it", async () => {
		const { dir, options } = appWith(
			`export const cms = {
				migrate: async ({ log }) => { calls.push("migrate"); log("migrating"); },
				close: async () => { calls.push("close"); },
			};`,
		);
		const logs: string[] = [];
		expect(await migrate({ ...options, log: (message) => logs.push(message) })).toBe(true);
		const { calls } = await import(pathToFileURL(path.join(dir, "monti.config.mjs")).href);
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
		const { calls } = await import(pathToFileURL(path.join(dir, "monti.config.mjs")).href);
		expect(calls).toEqual(["close"]);
		expect(error).toHaveBeenCalledWith("Migration failed:", expect.any(Error));
		error.mockRestore();
	});

	it("a config file that does not export an instance is refused with the shape to use", async () => {
		const { options } = appWith("export default { database: {}, auth: {} };");
		await expect(migrate(options)).rejects.toThrow(/must export the CMS instance.*defineConfig/);
	});
});
