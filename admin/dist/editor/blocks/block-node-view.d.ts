import { type NodeViewProps } from "@tiptap/react";
import { type BlockView } from "./use-block-editor.js";
/**
 * Default edit views of the core blocks, keyed by block name. They sit under the site's `blockViews` (`CmsAdminComponents`), so registering
 * a view with one of these names replaces it. Exported so a replacement can render the default view inside its own frame.
 */
export declare const DEFAULT_BLOCK_VIEWS: Readonly<Record<string, BlockView>>;
/**
 * The one node view of every block with an edit view: image, file, math, and the blocks added by block extensions or site config. It looks the
 * view up by block name in `blockViews` (falling back to the default view of a core block, a code preview for a fence block, and an
 * attribute-and-body box for any other added block) and renders it inside the block's `useBlockEditor` context.
 */
export declare function BlockNodeView(props: NodeViewProps): import("react").JSX.Element;
