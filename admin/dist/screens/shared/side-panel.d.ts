import type { ReactNode } from "react";
/** Width of the right slot (taxonomy edit, media detail, post properties). All right slots share the same width. */
export declare const SIDE_PANEL_WIDTH = "w-[22rem]";
/**
 * Place of the right slot opened beside the list (taxonomy edit, media detail). On narrow screens it covers the list,
 * on wide screens it sits beside the list at the same width as `SIDE_PANEL_WIDTH` (written literally so Tailwind can read it).
 */
export declare const SIDE_PANEL_DOCK = "absolute inset-y-0 right-0 z-20 w-full shadow-lg sm:w-[22rem] lg:static lg:shrink-0 lg:shadow-none";
/** Background of the item currently open in the list (open in the right slot or edit slot). */
export declare const OPEN_ITEM = "bg-cms-accent text-cms-accent-foreground";
/** Right slot header. A title and a close button (the name is always "Close"). */
export declare function SidePanelHeader({ title, onClose, className, children, }: {
    title?: ReactNode;
    onClose: () => void;
    className?: string;
    /** Content to put instead of (or next to) the title (tabs etc.). */
    children?: ReactNode;
}): import("react").JSX.Element;
