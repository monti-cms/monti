import { defineConfig } from "@monti-cms/core";
import { shikiNotation } from "../src";
import base from "./cms.config";

/**
 * The reference blog config with the Shiki notation extension switched on in the site config (`mdx.syntax`) and a `focus` line effect.
 * It runs only the tests that check the config-driven path (`*.configured.test.ts`, `vitest.configured.config.ts`):
 * the extension reaches the parser and the public render chain without an explicit list, and `[!code focus]` becomes the site's `focus` effect.
 */
export default defineConfig({
	...base,
	codeBlock: {
		lineEffects: [{ name: "focus", label: "Focus", class: "line-focus", editor: { background: "bg-cms-primary/10" } }],
	},
	mdx: { syntax: [shikiNotation()] },
});
