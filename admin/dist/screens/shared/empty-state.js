import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { cn } from "../../lib/utils/index.js";
import { Button } from "../../ui/button.js";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../ui/empty.js";
/**
 * The one empty look of the admin: an icon tile, a title, an optional one-line description and an optional action.
 * The full form fills the space of its list or grid and centers its content there, so every empty screen looks the same.
 * The compact form is for dialogs and popovers: just the text, without the tile.
 */
export function EmptyState({ icon: Icon, title, description, action, compact = false, className, }) {
    const ActionIcon = action?.icon;
    if (compact) {
        return (_jsxs(Empty, { "data-variant": "compact", className: cn("flex-none gap-1 p-2", className), children: [_jsxs(EmptyHeader, { className: "gap-0.5", children: [_jsx(EmptyTitle, { className: "font-normal text-cms-muted-foreground text-sm", children: title }), description && _jsx(EmptyDescription, { className: "text-xs", children: description })] }), action && (_jsxs(Button, { type: "button", size: "xs", variant: "outline", onClick: action.onClick, children: [ActionIcon && _jsx(ActionIcon, { "aria-hidden": true }), action.label] }))] }));
    }
    return (_jsxs(Empty, { "data-variant": "full", className: cn("min-h-64 flex-1", className), children: [_jsxs(EmptyHeader, { children: [Icon && (_jsx(EmptyMedia, { variant: "icon", children: _jsx(Icon, { "aria-hidden": true }) })), _jsx(EmptyTitle, { children: title }), description && _jsx(EmptyDescription, { children: description })] }), action && (_jsx(EmptyContent, { children: _jsxs(Button, { type: "button", size: "sm", variant: "outline", onClick: action.onClick, children: [ActionIcon && _jsx(ActionIcon, { "aria-hidden": true }), action.label] }) }))] }));
}
