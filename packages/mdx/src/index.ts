/**
 * MDX extension (`@monti-cms/mdx`). Imported by the site config file (`cms.config.ts`), so it is read by both the server and the browser: it holds the plugin
 * and the syntax extension API (types and constants) only, and nothing that parses MDX. The format is `@monti-cms/mdx/format`, the public renderer
 * `@monti-cms/mdx/render`, the admin side `@monti-cms/mdx/admin` and the server side `@monti-cms/mdx/server`.
 */
export { MDX_PLUGIN_NAME, type MdxPluginOptions, mdx, validateMdxOptions } from "./plugin";
export * from "./syntax";
