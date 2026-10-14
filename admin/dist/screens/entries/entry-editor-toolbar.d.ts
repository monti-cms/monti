import type { LucideIcon } from "lucide-react";
import type { SaveStatus } from "./entry-editor-types.js";
export declare function ToolbarAction({ label, icon: Icon, href, onClick, disabled, }: {
    label: string;
    icon: LucideIcon;
    href?: string;
    onClick?: () => void;
    disabled?: boolean;
}): import("react").JSX.Element;
/** Toggle button at the end of the editor toolbar (source pane, MDX source). Name and tooltip are the same. */
export declare function ToolbarToggle({ label, text, icon: Icon, pressed, disabled, onPressedChange, }: {
    label: string;
    /** Text next to the icon. If absent, only the icon shows (the name is the tooltip). */
    text?: string;
    icon: LucideIcon;
    pressed: boolean;
    disabled?: boolean;
    onPressedChange: (pressed: boolean) => void;
}): import("react").JSX.Element;
/** Save status in the header. On narrow screens only the dot shows, and the name is announced to screen readers. */
export declare function SaveStatusIndicator({ status, backupAvailable }: {
    status: SaveStatus;
    backupAvailable: boolean;
}): import("react").JSX.Element;
