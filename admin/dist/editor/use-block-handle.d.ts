/**
 * The block handle that floats beside the hovered block: tracks which block it points to, where it sits, and keeps it
 * attached while the page scrolls or resizes.
 */
import type { Editor } from "@tiptap/core";
import type { Coords } from "./screen-coords.js";
/** The handle shown on screen and the position of the block it moves. */
export type HandleSpot = Coords & {
    pos: number;
};
export declare function useBlockHandle(editor: Editor | null): {
    handleSpot: HandleSpot | null;
    setHandleSpot: import("react").Dispatch<import("react").SetStateAction<HandleSpot | null>>;
    handleMouseMove: (event: React.MouseEvent<HTMLDivElement>) => void;
    handleDragStart: (pos: number, event: React.DragEvent<HTMLElement>) => void;
    handleDragEnd: () => void;
};
