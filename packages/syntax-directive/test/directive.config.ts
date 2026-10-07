import { defineSite } from "@monti-cms/core";
import { mdx } from "@monti-cms/mdx";
import { directiveSyntax } from "../src";
import base from "./cms.config";

/**
 * The reference blog config with the directive syntax extension switched on in the site config (`mdx({ syntax })`).
 * It runs only the tests that check the config-driven path (`*.configured.test.ts`, `vitest.configured.config.ts`):
 * the extension reaches the `mdx` format of the instance (the server, the migrations and the admin) through the plugin options, without an explicit list.
 */
export default defineSite({ ...base, plugins: [mdx({ syntax: [directiveSyntax()] })] });
