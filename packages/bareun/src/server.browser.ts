import type { CmsServerPlugin } from "@monti-cms/core";

/**
 * `@monti-cms/bareun/server` for the browser bundle. The site config is also read in the browser, so the code that
 * loads the server side gets bundled too; this empty entry point replaces it so no server code is sent to the browser (the `browser` condition in package.json `exports`).
 */
const empty: CmsServerPlugin = {};

export default empty;
