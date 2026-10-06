/**
 * The admin side of the MDX package (`@monti-cms/mdx/admin`), loaded by the `mdx()` plugin: the source panel (edit a body as MDX text), the model of switching a body
 * between the visual editor and the text, and the browser side of the `mdx` format. The default export registers the format and the panel in the admin.
 */
import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { MdxAdminProvider } from "./provider";

export { type EditorMode, EditorToggle } from "./editor-toggle";
export { createMdxBrowserFormat, mdxBrowserFormat } from "./format";
export { MdxAdminProvider } from "./provider";
export { lineOfBlock, MDX_SOURCE_LABEL, MdxSourcePanel, SOURCE_ERROR_ID } from "./source-panel";

export default defineAdminPlugin({ Provider: MdxAdminProvider });
