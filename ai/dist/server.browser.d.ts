import type { CmsServerPlugin } from "@monti-cms/core";
/**
 * `@monti-cms/ai/server` for the browser bundle. The site config is also read in the browser, which would bundle the code that loads the server side;
 * this empty entry point replaces it so server code (AI SDK, DB) is not sent to the browser (the `browser` condition of package.json `exports`).
 */
declare const empty: CmsServerPlugin;
export default empty;
