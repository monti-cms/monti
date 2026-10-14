import { createMdxFormat } from "./format.js";
/**
 * The server side of the MDX package (`@monti-cms/mdx/server`): the `mdx` format as the server registers it. The plugin loads it lazily, so the MDX
 * parser stays out of the browser bundle (see `server.browser.ts`).
 */
export const createServerMdxFormat = (options = {}) => createMdxFormat(options);
