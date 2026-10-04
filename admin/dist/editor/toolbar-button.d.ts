import type { Editor } from "@tiptap/core";
import type { LucideIcon } from "lucide-react";
import type React from "react";
export interface ToolbarItem {
    label: string;
    title?: string;
    icon: LucideIcon;
    className?: string;
    isActive?: (editor: Editor) => boolean;
    isDisabled?: (editor: Editor) => boolean;
    run: (editor: Editor) => void;
}
/** Icon button for formatting tools and table tools. Does not steal the editor selection when pressed. */
export declare function ToolbarButton({ editor, item, tooltipSide, }: {
    editor: Editor;
    item: ToolbarItem;
    tooltipSide?: "top" | "bottom";
}): React.JSX.Element;
