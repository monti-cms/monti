/**
 * `@monti-cms/mdx/server` for the browser bundle. A bundler follows the plugin's `server: () => import("@monti-cms/mdx/server")` even though the browser never
 * calls it; this entry point replaces it so the MDX parser is not sent to the browser (the `browser` condition of package.json `exports`).
 */
export { emptyServerPlugin as default } from "@monti-cms/core";
