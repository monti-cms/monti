import type { ReactNode } from "react";
import { type PanelResizeConfig } from "../../ui/panel-resize.js";
/** Width classes of the right slot on wide screens: `--panel-width` comes from `usePanelResize` (written literally so Tailwind can read it). */
export declare const SIDE_PANEL_WIDTH = "w-[22rem] max-w-full sm:w-[var(--panel-width)]";
/** The right slot beside a list, with a drag handle on its left edge. The panel inside fills it. */
export declare function DockedPanel({ resize, children }: {
    resize: PanelResizeConfig;
    children: ReactNode;
}): import("react").JSX.Element;
/** Widths of the panels beside a list or an editor (px). Each kind remembers its own width. */
export declare const RECORD_PANEL_RESIZE: PanelResizeConfig;
export declare const MEDIA_PANEL_RESIZE: PanelResizeConfig;
export declare const INSPECTOR_PANEL_RESIZE: PanelResizeConfig;
/** Background of the item currently open in the list (open in the right slot or edit slot). */
export declare const OPEN_ITEM = "bg-monti-accent text-monti-accent-foreground";
/** Right slot header. A title and a close button (the name is always "Close"). */
export declare function SidePanelHeader({ title, onClose, className, children, }: {
    title?: ReactNode;
    onClose: () => void;
    className?: string;
    /** Content to put instead of (or next to) the title (tabs etc.). */
    children?: ReactNode;
}): import("react").JSX.Element;
