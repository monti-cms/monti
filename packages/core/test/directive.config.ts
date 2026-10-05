import { defineConfig } from "../src";
import { directiveSyntax } from "../src/syntax";
import base from "./cms.config";

/**
 * The reference blog config with the directive syntax extension switched on in the site config (`mdx.syntax`).
 * It runs only the tests that check the config-driven path with an extension (`*.directive.test.ts`, `vitest.directive.config.ts`);
 * every other test runs without extensions (standard MDX).
 */
export default defineConfig({ ...base, mdx: { syntax: [directiveSyntax()] } });
