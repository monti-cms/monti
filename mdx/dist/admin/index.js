/**
 * The admin side of the MDX package (`@monti-cms/mdx/admin`), loaded by the `mdx()` plugin: the source panel (edit a body as MDX text), the model of switching a body
 * between the visual editor and the text, and the browser side of the `mdx` format. The default export registers the format and the panel in the admin.
 */
import { defineAdminPlugin } from "@monti-cms/admin/plugins";
import { MdxAdminProvider } from "./provider.js";
export { EditorToggle } from "./editor-toggle.js";
export { createMdxBrowserFormat } from "./format.js";
export { MdxAdminProvider } from "./provider.js";
export { lineOfBlock, MdxSourcePanel, mdxSourceLabel, SOURCE_ERROR_ID } from "./source-panel.js";
export default defineAdminPlugin({ Provider: MdxAdminProvider });
