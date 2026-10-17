/**
 * The server side of the MDX package (`@monti-cms/mdx/server`): the `mdx` format, with the syntax extensions the site gave to `mdx({ syntax })`. The plugin loads it
 * lazily, so the MDX parser stays out of the browser bundle (see `server.browser.ts`).
 */
declare const _default: import("@monti-cms/core").ServerPlugin;
export default _default;
