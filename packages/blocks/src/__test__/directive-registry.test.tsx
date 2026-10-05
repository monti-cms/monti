import { BLOCK_JSX_NAMES, DIRECTIVES, REGISTERED_JSX_NAMES, RETIRED_JSX_NAMES } from "@monti-cms/core/mdx";
import { describe, expect, it, vi } from "vitest";

// Run with a config that adds blocks through the plugin (`blocks()`), so the public components come from the plugin `render`.
vi.mock("../../../core/src/config/resolved", async () => ({
	cmsConfig: (await import("../test/render-config")).default,
}));

const { mdxComponents } = await import("@monti-cms/core/render");

/**
 * Name consistency. If a registered name is missing from the public components or the registry, the public page silently renders empty
 * ("If directives are not handled, they do not emit anything"). The public components are the core defaults merged with the block extensions (`mdxComponents()`).
 */
describe("registry vs. public components", () => {
	it("registered directive components are in the merged component map", async () => {
		const components = await mdxComponents();
		const missing = DIRECTIVES.filter(
			(definition) => /^[A-Z]/.test(definition.component) && !(definition.component in components),
		).map((definition) => definition.name);

		expect(missing).toEqual([]);
	});

	it("registered directive component names are also in the registry", () => {
		const missing = DIRECTIVES.filter((definition) => !REGISTERED_JSX_NAMES.has(definition.component)).map(
			(definition) => definition.name,
		);

		expect(missing).toEqual([]);
	});

	it("retired names are in neither the registry nor the public components", async () => {
		const components = await mdxComponents();
		for (const name of RETIRED_JSX_NAMES) {
			expect(REGISTERED_JSX_NAMES.has(name)).toBe(false);
			expect(BLOCK_JSX_NAMES.has(name)).toBe(false);
			expect(name in components).toBe(false);
		}
	});
});
