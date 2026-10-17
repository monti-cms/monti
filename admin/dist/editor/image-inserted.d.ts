/**
 * Runs the `editor.imageInserted` subscribers for an image that was just inserted, and keeps the state the image view shows while they run. Each
 * subscriber runs on its own: its failure clears its part of the "generating" state and shows a notice, and never touches the image or the others.
 */
import type { Site } from "@monti-cms/core/site";
import type { Editor } from "@tiptap/core";
import type { ImageInserted } from "../events.js";
/** Whether subscribers of `editor.imageInserted` are still running for the image with this block id. */
export declare function useImageGenerating(blockId: string | null | undefined): boolean;
export declare function runImageInserted({ editor, blockId, subscribers, site, marker, failed, }: {
    editor: Editor;
    blockId: string;
    subscribers: readonly ImageInserted[];
    site: Site;
    /** How the image's place is marked in `around`. */
    marker: string;
    /** The notice of a subscriber that failed. */
    failed: string;
}): void;
