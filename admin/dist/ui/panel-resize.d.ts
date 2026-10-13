import { type CSSProperties } from "react";
/** Below this viewport width a panel covers the screen and cannot be resized. */
export declare const PANEL_RESIZE_MIN_VIEWPORT = 640;
export interface PanelResizeConfig {
    /** Kind of panel; the chosen width is remembered under this name for the site, in this browser. */
    readonly name: string;
    /** Width in px until the writer chooses one. */
    readonly defaultWidth: number;
    /** Narrowest width in px. */
    readonly minWidth: number;
}
export interface PanelResize {
    /** Current width in px (always within `min`..`max`). */
    readonly width: number;
    readonly min: number;
    readonly max: number;
    /** `false` on narrow screens, where the panel keeps its full width and has no handle. */
    readonly enabled: boolean;
    /** Sets the width of the panel; `persist` also remembers it. */
    readonly setWidth: (width: number, persist: boolean) => void;
    /** Back to the default width, and forgets the chosen one. */
    readonly reset: () => void;
    /** Put on the panel: its width as the CSS variable `--panel-width` (read with `sm:w-[var(--panel-width)]`). */
    readonly style: CSSProperties;
}
/**
 * Width of a right-side panel that the writer can drag. Between `minWidth` and 70% of the viewport (never closer than a small margin to its edge),
 * remembered per panel kind in the site's browser preferences. Missing storage means the default width.
 */
export declare function usePanelResize({ name, defaultWidth, minWidth }: PanelResizeConfig): PanelResize;
/**
 * The drag handle on the left edge of a right-side panel (the parent must be positioned). A separator: drag it, or focus it and use the arrow keys
 * (Left widens, Right narrows, Shift for bigger steps, Home and End for the limits); double-click goes back to the default width.
 */
export declare function PanelResizeHandle({ resize, className }: {
    resize: PanelResize;
    className?: string;
}): import("react").JSX.Element | null;
