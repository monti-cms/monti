import { describe, expect, it } from "vitest";
import { BLOCK_CHOICES } from "../../../core/src/cli/block-choices";
import { callout } from "../callout";
import { chart } from "../chart";
import { codeExplorer } from "../code-explorer";
import { codeRef } from "../code-ref";
import { collapsible } from "../collapsible";
import { color } from "../color";
import { columns } from "../columns";
import { mermaid } from "../mermaid";
import { tabs } from "../tabs";
import { tooltip } from "../tooltip";

/** `monti init` lists the blocks of this package by hand (core cannot import it): the list must follow the package. */
const PLUGINS = { callout, collapsible, tabs, columns, codeExplorer, mermaid, chart, tooltip, codeRef, color };

describe("the blocks `monti init` offers", () => {
	it("are exactly the block plugins of the package, each by the function and the name it lists", () => {
		expect(BLOCK_CHOICES.map((choice) => choice.fn).sort()).toEqual(Object.keys(PLUGINS).sort());
		for (const choice of BLOCK_CHOICES) {
			const plugin = PLUGINS[choice.fn as keyof typeof PLUGINS]();
			expect(plugin.name, choice.fn).toBe(choice.id);
		}
	});

	it("name the package a heavy block needs", () => {
		expect(BLOCK_CHOICES.filter((choice) => choice.needs).map((choice) => choice.id)).toEqual(["mermaid", "chart"]);
	});
});
