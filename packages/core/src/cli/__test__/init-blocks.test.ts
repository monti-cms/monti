import { describe, expect, it } from "vitest";
import { initProject } from "../init";
import { fakeHost, fixtureApp, read } from "./init-helpers";

const run = async (blocks: string) => {
	const dir = fixtureApp();
	const host = fakeHost();
	await initProject({ cwd: dir, host, env: {}, blocks, database: "skip" });
	const install = host.install.mock.calls[0]?.[0].args ?? [];
	return { config: read(dir, "monti.config.ts"), install };
};

describe("monti init and the heavy blocks", () => {
	it("the default blocks import from the barrel and install neither mermaid nor recharts", async () => {
		const { config, install } = await run("default");
		expect(config).toContain('from "@monti-cms/blocks";');
		expect(config).not.toContain("@monti-cms/blocks/chart");
		expect(config).not.toContain("@monti-cms/blocks/mermaid");
		expect(install).toContain("@monti-cms/blocks");
		expect(install).not.toContain("recharts");
		expect(install).not.toContain("mermaid");
	});

	it("chart and mermaid come from their own entry points, and their libraries are installed only then", async () => {
		const { config, install } = await run("default,chart,mermaid");
		expect(config).toContain('import { chart } from "@monti-cms/blocks/chart";');
		expect(config).toContain('import { mermaid } from "@monti-cms/blocks/mermaid";');
		// The barrel import has none of the two.
		const barrel = config.split("\n").find((line) => line.endsWith('from "@monti-cms/blocks";')) ?? "";
		expect(barrel).not.toMatch(/\b(chart|mermaid)\b/);
		expect(install).toEqual(expect.arrayContaining(["recharts", "mermaid"]));
		expect(config).toContain("chart(),");
		expect(config).toContain("mermaid(),");
	});

	it("only the chosen heavy block brings its library", async () => {
		const { config, install } = await run("default,chart");
		expect(config).toContain('from "@monti-cms/blocks/chart"');
		expect(config).not.toContain("@monti-cms/blocks/mermaid");
		expect(install).toContain("recharts");
		expect(install).not.toContain("mermaid");
	});
});
