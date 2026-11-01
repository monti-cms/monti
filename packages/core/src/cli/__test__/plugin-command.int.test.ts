import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
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

describe("monti commands run against the instance the config file exports", () => {
	it("PLUG-S2 `monti <plugin>:<command>` loads the instance of the file --config names, runs the command with it, and closes it", async () => {
		const dir = tempDir({
			"custom/app.mjs": `export const calls = [];
export const cms = {
	migrate: async () => undefined,
	close: async () => { calls.push("close"); },
	plugins: async () => [{ name: "demo", commands: { go: {
		description: "Goes",
		options: { name: { type: "string" } },
		run: async ({ cms: instance, args }) => { calls.push({ args, same: instance === cms, env: process.env.MONTI_PLUGIN_TEST }); },
	} } }],
	plugin: () => ({}),
};
`,
			".env.local": "MONTI_PLUGIN_TEST=from-env-file\n",
		});
		const io = { cwd: dir, log: () => undefined, error: () => undefined };
		expect(await runCli(["demo:go", "--name", "x", "--no-env-file", "--config", "custom/app.mjs"], io)).toBe(0);
		const { calls } = await import(pathToFileURL(path.join(dir, "custom/app.mjs")).href);
		// --no-env-file: the .env.local next to it was not read.
		expect(calls).toEqual([{ args: { name: "x" }, same: true, env: undefined }, "close"]);
	});
});
