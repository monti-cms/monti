import { type EditorMarkExtension } from "@monti-cms/admin/editor";
import type { ReactNode } from "react";
/** Editor mark name (`cmsTooltip`). */
export declare const TOOLTIP_MARK: string;
/** Window event the slash menu uses to open the format tool's tooltip input. */
export declare const OPEN_TOOLTIP_EVENT = "cms:open-tooltip";
/** Editor registration of the tooltip mark. Shown with a dotted underline, and text typed right after the end of a tooltip becomes part of it. */
export declare const tooltipMarkExtension: EditorMarkExtension;
/** Registers the tooltip mark's editor display, format tool, bubble, and slash menu in the admin UI. */
export declare function TooltipProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
