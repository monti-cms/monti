import { CmsMathNode } from "./blocks/fence-preview/index.js";
import { CmsFileNode } from "./file-node.js";
import { CmsImageNode } from "./image-node.js";
/**
 * Registry from the core block definitions' `editor.nodeView` name → Tiptap node (including NodeView).
 *
 * Definitions are shared with the server, so they hold only names, not React or Tiptap code. Blocks added by block extensions or site config
 * create their nodes from the definition (`blocks/added`). A block that is neither is shown as a raw-source preserving box (`cmsOpaqueBlock`).
 */
export const BLOCK_NODE_VIEWS = {
    image: CmsImageNode,
    file: CmsFileNode,
    math: CmsMathNode,
};
