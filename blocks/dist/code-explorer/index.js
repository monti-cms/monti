import { definePlugin } from "@monti-cms/core";
import { codeExplorerBlock } from "./definition.js";
export { codeExplorerBlock } from "./definition.js";
/**
 * Code explorer block (`:::code-explorer`). A file tree with the code of the picked file. Add it to the site config's `plugins`.
 *
 * ```ts
 * plugins: [codeExplorer()]
 * ```
 *
 * For the public page, this extension provides a default public component (`render`, used by `@monti-cms/core/render`). A site can override it with a component of the same name.
 */
export const codeExplorer = () => definePlugin({
    name: "code-explorer",
    options: {},
    blocks: [codeExplorerBlock],
    admin: () => import("@monti-cms/blocks/code-explorer/admin"),
    render: () => import("@monti-cms/blocks/code-explorer/render"),
});
