"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useSite } from "@monti-cms/core/client";
import { NodeViewWrapper } from "@tiptap/react";
import { useCmsAdminComponents } from "../../admin-components.js";
import { FileBlockView } from "../file-node-view.js";
import { ImageBlockView } from "../image-node-view.js";
import { DefaultBlockView, FenceBlockView } from "./added/view.js";
import { MathBlockView } from "./fence-preview/index.js";
import { blockOfNode } from "./node-block.js";
import { BlockEditorProvider } from "./use-block-editor.js";
/**
 * Default edit views of the core blocks, keyed by block name. They sit under the site's `blockViews` (`CmsAdminComponents`), so registering
 * a view with one of these names replaces it. Exported so a replacement can render the default view inside its own frame.
 */
export const DEFAULT_BLOCK_VIEWS = {
    image: ImageBlockView,
    file: FileBlockView,
    math: MathBlockView,
};
/**
 * The one node view of every block with an edit view: image, file, math, and the blocks added by block extensions or site config. It looks the
 * view up by block name in `blockViews` (falling back to the default view of a core block, a code preview for a fence block, and an
 * attribute-and-body box for any other added block) and renders it inside the block's `useBlockEditor` context.
 */
export function BlockNodeView(props) {
    const site = useSite();
    const definition = blockOfNode(site, props.node.type.name);
    const { blockViews } = useCmsAdminComponents();
    if (!definition)
        return _jsx(NodeViewWrapper, {});
    const View = blockViews?.[definition.name] ??
        DEFAULT_BLOCK_VIEWS[definition.name] ??
        (definition.syntax.kind === "fence" ? FenceBlockView : DefaultBlockView);
    return (_jsx(BlockEditorProvider, { nodeView: props, definition: definition, children: _jsx(View, {}) }));
}
