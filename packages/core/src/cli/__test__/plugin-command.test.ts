import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCms } from "../../cms";
import type { PluginCommand } from "../../plugin/define";
import { runPluginCommandWith } from "../plugin-command";

const lines: string[] = [];
const io = {
	cwd: "/app",
	log: (message: string) => lines.push(message),
	error: (message: string) => lines.push(`E:${message}`),
};

/** An instance with one plugin, `demo`, that has these commands; `close` records that it was closed. */
const appWith = (commands: Record<string, PluginCommand>) => {
	const close = vi.fn(async () => undefined);
	return { cms: { ...fakeCms({ plugins: [{ name: "demo", commands }] }), close }, close };
};

beforeEach(() => {
	lines.length = 0;
});

describe("monti <plugin>:<command>", () => {
	it("PLUG-S2 runs the command of the named plugin with the instance and its options, and closes the instance", async () => {
		const run = vi.fn(async () => undefined);
		const { cms, close } = appWith({
			go: { description: "Goes", options: { all: { type: "boolean" }, name: { type: "string" } }, run },
		});
		// The app options are accepted next to the command's own; they are for loading the app, so the command does not get them.
		const argv = ["--all", "--name", "x", "--no-env-file", "--config", "s.ts"];
		expect(await runPluginCommandWith(cms, io, "demo:go", argv)).toBe(0);
		expect(run).toHaveBeenCalledOnce();
		expect(run).toHaveBeenCalledWith(expect.objectContaining({ cms, args: { all: true, name: "x" } }));
		expect(close).toHaveBeenCalledOnce();
	});

	it("PLUG-S2 exits with the code the command returns", async () => {
		const { cms } = appWith({ fail: { description: "Fails", run: async () => 3 } });
		expect(await runPluginCommandWith(cms, io, "demo:fail", [])).toBe(3);
	});

	it("PLUG-S2 names the commands the app has when the plugin or command is unknown", async () => {
		const { cms, close } = appWith({ go: { description: "Goes", run: async () => undefined } });
		expect(await runPluginCommandWith(cms, io, "demo:nope", [])).toBe(1);
		expect(lines.join("\n")).toContain("Plugin commands of this app: demo:go");
		expect(await runPluginCommandWith(cms, io, "other:go", [])).toBe(1);
		expect(close).toHaveBeenCalledTimes(2);
	});

	it("PLUG-S2 rejects an option the command does not declare, and prints help for --help", async () => {
		const { cms } = appWith({
			go: {
				description: "Goes",
				options: { all: { type: "boolean", description: "Everything" } },
				run: async () => undefined,
			},
		});
		await expect(runPluginCommandWith(cms, io, "demo:go", ["--bogus"])).rejects.toThrow("--bogus");
		lines.length = 0;
		expect(await runPluginCommandWith(cms, io, "demo:go", ["--help"])).toBe(0);
		expect(lines.join("\n")).toContain("--all  Everything");
	});
});
