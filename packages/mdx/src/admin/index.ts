/**
 * The admin side of the MDX package (`@monti-cms/mdx/admin`), loaded by the `mdx()` plugin: the source panel (edit a body as MDX text), the model of switching a body
 * between the visual editor and the text, and the browser side of the `mdx` format. The default export registers the format and the panel in the admin.
 */

import { mdxComponents } from "./provider";

export { type EditorMode, EditorToggle } from "./editor-toggle";
export { createMdxBrowserFormat } from "./format";
export { mdxComponents } from "./provider";
export { lineOfBlock, MdxSourcePanel, mdxSourceLabel } from "./source-panel";

import { defineAdminPlugin } from "@monti-cms/admin";

export default defineAdminPlugin({ components: mdxComponents });
