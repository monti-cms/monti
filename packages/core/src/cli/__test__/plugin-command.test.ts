import { beforeEach, describe, expect, it, vi } from "vitest";
import { fakeCms } from "../../cms";
import type { PluginCommand } from "../../plugin/define";
import { runCli } from "../index";

const state = vi.hoisted(() => ({ cms: undefined as unknown, loaded: [] as unknown[] }));
vi.mock("../app", () => ({
	loadApp: async (options: unknown) => {
		state.loaded.push(options);
		return state.cms;
	},
}));

const lines: string[] = [];
const io = {
	cwd: "/app",
	log: (message: string) => lines.push(message),
	error: (message: string) => lines.push(`E:${message}`),
};

const appWith = (commands: Record<string, PluginCommand>) => {
	const close = vi.fn(async () => undefined);
	state.cms = {
		...fakeCms({ plugins: [{ name: "demo", commands }] }),
		close,
	};
	return close;
};

beforeEach(() => {
	lines.length = 0;
	state.loaded.length = 0;
});

describe("monti <plugin>:<command>", () => {
	it("runs the command of the named plugin with the instance and its options, and closes the instance", async () => {
		const run = vi.fn(async ({ args }: { args: Record<string, unknown> }) => {
			lines.push(`ran ${JSON.stringify(args)}`);
		});
		const close = appWith({
			go: { description: "Goes", options: { all: { type: "boolean" }, name: { type: "string" } }, run: run as never },
		});
		expect(await runCli(["demo:go", "--all", "--name", "x", "--no-env-file", "--server", "s.ts"], io)).toBe(0);
		expect(lines).toContain('ran {"all":true,"name":"x"}');
		expect(state.loaded[0]).toMatchObject({ cwd: "/app", envFiles: [], server: "s.ts" });
		expect(run).toHaveBeenCalledOnce();
		expect(close).toHaveBeenCalledOnce();
	});

	it("exits with the code the command returns", async () => {
		appWith({ fail: { description: "Fails", run: async () => 3 } });
		expect(await runCli(["demo:fail"], io)).toBe(3);
	});

	it("names the commands the app has when the plugin or command is unknown", async () => {
		const close = appWith({ go: { description: "Goes", run: async () => undefined } });
		expect(await runCli(["demo:nope"], io)).toBe(1);
		expect(lines.join("\n")).toContain("Plugin commands of this app: demo:go");
		expect(await runCli(["other:go"], io)).toBe(1);
		expect(close).toHaveBeenCalledTimes(2);
	});

	it("rejects an option the command does not declare, and prints help for --help", async () => {
		appWith({
			go: {
				description: "Goes",
				options: { all: { type: "boolean", description: "Everything" } },
				run: async () => undefined,
			},
		});
		expect(await runCli(["demo:go", "--bogus"], io)).toBe(1);
		lines.length = 0;
		expect(await runCli(["demo:go", "--help"], io)).toBe(0);
		expect(lines.join("\n")).toContain("--all  Everything");
	});
});
