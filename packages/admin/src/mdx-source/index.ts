/**
 * Everything the admin knows about MDX, in one place: the `mdx` format as the browser uses it, its source panel, the model of switching a body between the
 * visual editor and the text, and the provider that registers them (`sourcePanels`, `formats`). It moves to `@monti-cms/mdx/admin` with the rest of MDX.
 */
export { type EditorMode, EditorToggle } from "./editor-toggle";
export { mdxBrowserFormat } from "./format";
export { MdxSourceProvider } from "./provider";
export { MdxSourcePanel, SOURCE_ERROR_ID } from "./source-panel";
