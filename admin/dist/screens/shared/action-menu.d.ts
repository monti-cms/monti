import { type LucideIcon } from "lucide-react";
import { type ReactElement } from "react";
/**
 * Menu definition shared by the right-click menu and the `⋯` button. Rendering the same list in two places
 * lets users who don't know right-click or can't use it (touch) do the same actions.
 */
export type MenuAction = {
    kind: "item";
    label: string;
    /** Icon before the item. Every menu item has an icon. */
    icon?: LucideIcon;
    onSelect: () => void;
    destructive?: boolean;
    disabled?: boolean;
    /** Shortcut hint shown on screen. The caller handles the actual key handling. */
    shortcut?: string;
} | {
    kind: "sub";
    label: string;
    icon?: LucideIcon;
    items: MenuAction[];
    emptyLabel?: string;
    disabled?: boolean;
} | {
    kind: "label";
    label: string;
} | {
    kind: "separator";
};
/**
 * Right-clicking `trigger` (or Shift+F10 / the menu key) opens the menu. `trigger` is the element to actually render
 * (e.g. `<TableRow />`). If the menu is empty, right-click is not intercepted.
 */
export declare function ActionContextMenu({ actions, trigger, children, onOpenChange, }: {
    actions: MenuAction[];
    trigger: ReactElement;
    children?: React.ReactNode;
    onOpenChange?: (open: boolean) => void;
}): import("react").JSX.Element;
/** Always-visible `⋯` button. Opens the same items as the right-click menu. */
export declare function MoreActionsButton({ actions, label, className, }: {
    actions: MenuAction[];
    /** Button name and tooltip (e.g. `'알고리즘' 폴더 작업`). */
    label: string;
    className?: string;
}): import("react").JSX.Element | null;
