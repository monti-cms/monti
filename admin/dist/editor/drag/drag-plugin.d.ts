import { Extension } from "@tiptap/core";
import { PluginKey } from "@tiptap/pm/state";
import type { EditorView } from "@tiptap/pm/view";
export declare const BLOCK_DRAG_MIME_TYPE = "application/x-cms-block-drag";
export declare const cmsBlockDragPluginKey: PluginKey<{
    dropPos: number | null;
}>;
/**
 * Called on block handle dragstart to initialize the ProseMirror drag state and dataTransfer.
 * If the grabbed block is inside a block selection (lines picked with the marquee), all selected lines are dragged together.
 */
export declare function startBlockDrag(view: EditorView, pos: number, event: React.DragEvent<HTMLElement> | DragEvent): boolean;
/**
 * Cleans up state when the drag ends.
 */
export declare function endBlockDrag(view: EditorView): void;
/**
 * Tiptap block drag-and-drop extension.
 * Provides schema validation, a single undo transaction, and rejection of disallowed positions.
 */
export declare const CmsBlockDrag: Extension<any, any>;
