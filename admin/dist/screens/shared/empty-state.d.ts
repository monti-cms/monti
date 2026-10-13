import type { LucideIcon } from "lucide-react";
export interface EmptyStateAction {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
}
/**
 * The one empty look of the admin: an icon tile, a title, an optional one-line description and an optional action.
 * The full form fills the space of its list or grid and centers its content there, so every empty screen looks the same.
 * The compact form is for dialogs and popovers: just the text, without the tile.
 */
export declare function EmptyState({ icon: Icon, title, description, action, compact, className, }: {
    icon?: LucideIcon;
    title: string;
    description?: string;
    action?: EmptyStateAction;
    compact?: boolean;
    className?: string;
}): import("react").JSX.Element;
