/** The dropdown button used by the toolbar for grouped tools (block shape, alignment, lists, ...). */
import type { Editor } from "@tiptap/core";
import { type LucideIcon } from "lucide-react";
import type { ToolbarItem } from "./toolbar-button.js";
export declare function ToolbarDropdown({ editor, label, items, icon: Icon, iconOnly, }: {
    editor: Editor;
    label: string;
    items: ToolbarItem[];
    icon?: LucideIcon;
    /** Shows only the icon, no text. The name is conveyed via aria-label and tooltip. */
    iconOnly?: boolean;
}): import("react").JSX.Element;
