import { describe, expect, it } from "vitest";
import { allBlocks } from "../test/all-blocks";

/**
 * Name consistency. If a block is missing from its extension's render module, the public page draws the fallback instead. Each extension's `render` module has a
 * `defineRender` table as its default export, keyed by block name (`marks` for text blocks, `blocks` for the rest).
 */
describe("block extensions vs. their public components", () => {
	const plugins = allBlocks();

	it("every extension has a render module whose default export is its component table", async () => {
		expect(plugins.length).toBeGreaterThan(0);
		for (const plugin of plugins) {
			expect(plugin.render, plugin.name).toBeTypeOf("function");
			const table = (await plugin.render?.())?.default;
			expect(table?.blocks ?? table?.marks, plugin.name).toBeTypeOf("object");
		}
	});

	it("every block that is not a child of another block has a component", async () => {
		for (const plugin of plugins) {
			const table = (await plugin.render?.())?.default;
			for (const block of plugin.blocks ?? []) {
				// A child block (tab, column, row, cell) is drawn by its parent.
				if ("parent" in block && block.parent) continue;
				const components = block.syntax.kind === "text" ? table?.marks : table?.blocks;
				expect(components?.[block.name], `${plugin.name}: ${block.name}`).toBeDefined();
			}
		}
	});
});
