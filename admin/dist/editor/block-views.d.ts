import type { Node } from "@tiptap/core";
/**
 * Registry from the core block definitions' `editor.nodeView` name → Tiptap node (including NodeView).
 *
 * Definitions are shared with the server, so they hold only names, not React or Tiptap code. Blocks added by block extensions or site config
 * create their nodes from the definition (`blocks/added`). A block that is neither is shown as a raw-source preserving box (`cmsOpaqueBlock`).
 */
export declare const BLOCK_NODE_VIEWS: Readonly<Record<string, Node>>;
