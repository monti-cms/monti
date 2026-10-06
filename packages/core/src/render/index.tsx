/**
 * Body rendering (`@monti-cms/core/render`). Draws the stored document with React: `renderDocument` and `CmsContent` (see `./document`). The components are overridden in this
 * order: core defaults (link, image, file, table, alignment, code lines) → public components of block extensions (plugin `render`, its `documentComponents`) → the ones the
 * site passes. Call it from a server component. It compiles and executes no text: a body in a text format (MDX) is read into a document first (`@monti-cms/mdx/render`).
 */

export * from "./document";
export type { RenderLabels } from "./labels";
