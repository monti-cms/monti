import { describe, expect, it } from "vitest";
import { allBlocks } from "../test/all-blocks";

/**
 * Name consistency. If a block is missing from its extension's render module, the public page draws the fallback instead. Each extension's `render` module exports
 * `documentComponents`, and the components it returns are keyed by block name (`marks` for text blocks, `blocks` for the rest).
 */
describe("block extensions vs. their public components", () => {
	const plugins = allBlocks();

	it("every extension has a render module that exports documentComponents", async () => {
		expect(plugins.length).toBeGreaterThan(0);
		for (const plugin of plugins) {
			expect(plugin.render, plugin.name).toBeTypeOf("function");
			const module = (await plugin.render?.()) as { documentComponents?: unknown } | undefined;
			expect(module?.documentComponents, plugin.name).toBeTypeOf("function");
		}
	});

	it("every block that is not a child of another block has a component", async () => {
		for (const plugin of plugins) {
			const module = (await plugin.render?.()) as {
				documentComponents: (context: { locale?: string }) => {
					marks?: Record<string, unknown>;
					blocks?: Record<string, unknown>;
				};
			};
			const components = module.documentComponents({ locale: "ko" });
			for (const block of plugin.blocks ?? []) {
				// A child block (tab, column, row, cell) is drawn by its parent.
				if ("parent" in block && block.parent) continue;
				const table = block.syntax.kind === "text" ? components.marks : components.blocks;
				expect(table?.[block.name], `${plugin.name}: ${block.name}`).toBeDefined();
			}
		}
	});

	it("does not leave an MDX component table in the render modules", async () => {
		for (const plugin of plugins) {
			const module = (await plugin.render?.()) as Record<string, unknown>;
			expect(module.default, plugin.name).toBeUndefined();
		}
	});
});
