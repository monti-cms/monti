/**
 * `@monti-cms/mdx/server` for the browser bundle. The site config is also read in the browser, and `plugin.ts` imports the server side lazily;
 * this entry point replaces it so the MDX parser is not sent to the browser (the `browser` condition of package.json `exports`).
 * It exists only so the export name matches; the server side never runs in the browser.
 */
const serverOnly = (name) => {
    throw new Error(`@monti-cms/mdx/server: ${name} runs on the server only.`);
};
export const createServerMdxFormat = (_options = {}) => serverOnly("createServerMdxFormat");
