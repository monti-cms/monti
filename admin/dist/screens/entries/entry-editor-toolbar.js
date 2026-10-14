"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Small header pieces of the entry editor: icon actions, toggles and the save status indicator.
import { useTranslator } from "@monti-cms/core/client";
import { cn } from "../../lib/utils/cn.js";
import { buttonVariants } from "../../ui/button.js";
import { IconButton } from "../../ui/icon-button.js";
import { StatusIndicator } from "../../ui/status-indicator.js";
import { Toggle } from "../../ui/toggle.js";
import { Tooltip, TooltipContent, TooltipTrigger } from "../../ui/tooltip.js";
import { entryEditorShellMessages } from "./entry-editor-shell.messages.js";
import { entriesMessages } from "./messages.js";
export function ToolbarAction({ label, icon: Icon, href, onClick, disabled = false, }) {
    const className = "size-8 shrink-0 text-cms-muted-foreground";
    const icon = _jsx(Icon, { "aria-hidden": true, className: "size-4" });
    if (!href || disabled) {
        return (_jsx(IconButton, { label: label, side: "bottom", disabled: disabled, className: className, onClick: onClick, children: icon }));
    }
    // A link stays a link (open in new tab, copy URL). Its name and tooltip match the icon buttons.
    return (_jsxs(Tooltip, { children: [_jsx(TooltipTrigger, { render: _jsx("a", { href: href, target: "_blank", rel: "noopener noreferrer", "aria-label": label, className: cn(buttonVariants({ variant: "ghost", size: "icon-sm" }), className), children: icon }) }), _jsx(TooltipContent, { side: "bottom", children: label })] }));
}
/** Toggle button at the end of the editor toolbar (source pane, MDX source). Name and tooltip are the same. */
export function ToolbarToggle({ label, text, icon: Icon, pressed, disabled, onPressedChange, }) {
    return (_jsxs(Tooltip, { children: [_jsxs(TooltipTrigger, { render: _jsx(Toggle, { size: "sm", "aria-label": label, pressed: pressed, disabled: disabled, onPressedChange: onPressedChange, className: "gap-1.5 text-cms-muted-foreground aria-pressed:text-cms-foreground" }), children: [_jsx(Icon, { "aria-hidden": true, className: "size-4" }), text] }), _jsx(TooltipContent, { side: "bottom", children: label })] }));
}
/** Name of each save status. */
const saveStatusLabels = (te) => ({
    new: te("save.new"),
    saved: te("save.saved"),
    dirty: te("save.dirty"),
    saving: te("save.saving"),
    "local-only": te("save.local-only"),
    failed: te("save.failed"),
    conflict: te("save.conflict"),
    "session-expired": te("save.session-expired"),
});
/** Tone of the save status dot. When adding a status, its tone must be chosen here. */
const SAVE_STATUS_TONE = {
    new: "neutral",
    saved: "success",
    dirty: "neutral",
    saving: "warning",
    "local-only": "neutral",
    failed: "destructive",
    conflict: "destructive",
    "session-expired": "destructive",
};
/** Save status in the header. On narrow screens only the dot shows, and the name is announced to screen readers. */
export function SaveStatusIndicator({ status, backupAvailable }) {
    const t = useTranslator(entryEditorShellMessages);
    const te = useTranslator(entriesMessages);
    const label = `${saveStatusLabels(te)[status]}${backupAvailable ? "" : t("backupUnavailable")}`;
    return (_jsxs("output", { "aria-live": "polite", "aria-label": label, className: "mr-1 flex items-center gap-1.5 text-cms-muted-foreground text-xs", children: [_jsx(StatusIndicator, { size: "sm", tone: SAVE_STATUS_TONE[status], pulse: status === "saving" }), _jsx("span", { className: "hidden lg:inline", children: label })] }));
}
