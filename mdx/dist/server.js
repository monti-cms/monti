import { defineServerPlugin } from "@monti-cms/core/server";
import { createMdxFormat } from "./format.js";
import { MDX_PLUGIN } from "./plugin.js";
/**
 * The server side of the MDX package (`@monti-cms/mdx/server`): the `mdx` format, with the syntax extensions the site gave to `mdx({ syntax })`. The plugin loads it
 * lazily, so the MDX parser stays out of the browser bundle (see `server.browser.ts`).
 */
export default defineServerPlugin({
    formats: ({ cms }) => createMdxFormat(cms.site.pluginOptions(MDX_PLUGIN) ?? {}),
});
