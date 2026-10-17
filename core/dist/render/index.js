/**
 * Body rendering (`@monti-cms/core/render`). Draws the stored document with React: `renderDocument` and `CmsContent` (see `./document`). The components are overridden in this
 * order: core defaults (link, image, file, table, alignment, code lines) → public components of block extensions (the `defineRender` table of a plugin's `render` module) → the ones the
 * site passes. Call it from a server component. It compiles and executes no text: a body in a text format (MDX) is read into a document first (`@monti-cms/mdx/render`).
 */
export { CmsContent, imageResolverFromRefs, mergeDocumentComponents, readCodeBlock, renderDocument, tableOfContents, } from "./document/index.js";
export { defineRender } from "./plugin-render.js";
