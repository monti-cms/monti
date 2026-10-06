import type { Node } from "@tiptap/core";
import { CmsMathNode } from "./blocks/fence-preview";
import { CmsFileNode } from "./file-node";
import { CmsImageNode } from "./image-node";

/**
 * Registry from the core block definitions' `editor.nodeView` name to its Tiptap node: the schema (attributes, parse and render rules) of
 * image, file and math. The edit views are not here: every block, these three included, draws its edit view from `blockViews`
 * (`CmsAdminComponents`), where the default views are registered (`DEFAULT_BLOCK_VIEWS`) and a site can replace them.
 *
 * Definitions are shared with the server, so they hold only names, not React or Tiptap code. Blocks added by block extensions or site config
 * create their nodes from the definition (`blocks/added`). A block that is neither is shown as a raw-source preserving box (`cmsOpaqueBlock`).
 */
export const BLOCK_NODES: Readonly<Record<string, Node>> = {
	image: CmsImageNode,
	file: CmsFileNode,
	math: CmsMathNode,
};
