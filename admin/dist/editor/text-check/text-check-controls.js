"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createTranslator } from "@monti-cms/core/client";
import { posToDOMRect } from "@tiptap/core";
import { CircleAlert, EyeOff, Info, Loader2, SpellCheck, TriangleAlert } from "lucide-react";
import { useMemo, useRef } from "react";
import { cn } from "../../lib/utils/cn.js";
import { useIconByName } from "../../screens/shared/collection-icon.js";
import { Button } from "../../ui/button.js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../ui/dropdown-menu.js";
import { IconButton } from "../../ui/icon-button.js";
import { Popover, PopoverContent } from "../../ui/popover.js";
import { textCheckMessages } from "./messages.js";
import { textCheckIssues } from "./plugin.js";
const t = createTranslator(textCheckMessages);
const SEVERITY_ICON = {
    error: { icon: CircleAlert, className: "text-cms-destructive" },
    warning: { icon: TriangleAlert, className: "text-cms-warning" },
    info: { icon: Info, className: "text-cms-primary" },
};
function SeverityIcon({ severity }) {
    const { icon: Icon, className } = SEVERITY_ICON[severity];
    return _jsx(Icon, { "aria-hidden": true, className: cn("size-4 shrink-0", className) });
}
/** One checker button. Its name and icon come from the checker definition (`label`, `icon`). */
function CheckerButton({ checker, controller }) {
    const iconByName = useIconByName();
    const Icon = (typeof checker.icon === "string" ? iconByName(checker.icon) : checker.icon) ?? SpellCheck;
    const running = controller.running === checker.id;
    return (_jsx(IconButton, { label: running ? t("running") : checker.label, side: "bottom", disabled: controller.running !== null || !controller.editor.isEditable, 
        // Keep editor focus so the picked text is not lost.
        onMouseDown: (event) => event.preventDefault(), onClick: () => void controller.run(checker.id), children: running ? _jsx(Loader2, { "aria-hidden": true, className: "size-4 animate-spin" }) : _jsx(Icon, { "aria-hidden": true, className: "size-4" }) }));
}
/** Checker buttons of the toolbar (one per checker) and the result count (click for the result list). */
export function TextCheckToolbar({ controller }) {
    const { issues } = controller;
    const count = issues.length;
    return (_jsxs("div", { className: "flex items-center gap-0.5", children: [controller.checkers.map((checker) => (_jsx(CheckerButton, { checker: checker, controller: controller }, checker.id))), count > 0 && (_jsxs(DropdownMenu, { children: [_jsx(IconButton, { label: t("results"), side: "bottom", size: "sm", className: "h-8 min-w-8 px-1.5", onMouseDown: (event) => event.preventDefault(), trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: _jsx("span", { className: "tabular rounded-full bg-cms-muted px-1.5 font-medium text-xs leading-5", children: count > 99 ? "99+" : count }) }), _jsx(DropdownMenuContent, { align: "end", className: "max-h-80 w-72 overflow-y-auto", children: issues.map((issue) => (_jsxs(DropdownMenuItem, { className: "items-start", onClick: () => controller.jump(issue), children: [_jsx(SeverityIcon, { severity: issue.severity }), _jsxs("span", { className: "flex min-w-0 flex-1 flex-col", children: [_jsx("span", { className: "truncate font-medium", children: issue.text.trim() || issue.message }), issue.message && _jsx("span", { className: "truncate text-cms-muted-foreground text-xs", children: issue.message })] })] }, issue.key))) })] }))] }));
}
/** Result popup that appears at the spot when an underline is clicked or picked from the list: explanation, replacement candidates, ignore. */
export function TextIssuePopover({ controller }) {
    const { editor, open, issues, pluginKey } = controller;
    const issue = open ? issues.find((item) => item.key === open.key) : undefined;
    const key = issue?.key;
    // A popup opened from the list (keyboard) returns focus to the body on close. A popup opened by clicking an underline did not move focus.
    const returnFocusRef = useRef(false);
    if (open)
        returnFocusRef.current = open.focus;
    // Underlines can be redrawn, so measure the position from the current document position instead of a DOM element.
    const anchor = useMemo(() => key
        ? {
            getBoundingClientRect: () => {
                const current = textCheckIssues(editor.state, pluginKey).find((item) => item.key === key);
                if (!current || editor.isDestroyed)
                    return new DOMRect();
                try {
                    return posToDOMRect(editor.view, current.from, current.to);
                }
                catch {
                    return new DOMRect();
                }
            },
        }
        : null, [editor, key, pluginKey]);
    return (_jsx(Popover, { open: !!issue, onOpenChange: (next) => {
            if (!next)
                controller.close();
        }, children: _jsx(PopoverContent, { anchor: anchor, side: "bottom", align: "start", initialFocus: open?.focus ?? false, finalFocus: () => (returnFocusRef.current ? editor.view.dom : false), "aria-label": t("results"), className: "w-72 gap-3 p-3", children: issue && _jsx(IssueCard, { controller: controller, issue: issue }) }) }));
}
function IssueCard({ controller, issue }) {
    const checker = controller.checkers.find((item) => item.id === issue.checkerId);
    const editable = controller.editor.isEditable;
    return (_jsxs(_Fragment, { children: [_jsxs("div", { className: "flex items-start gap-2", children: [_jsx(SeverityIcon, { severity: issue.severity }), _jsx("p", { className: "min-w-0 flex-1 text-sm", children: issue.message || issue.text })] }), issue.suggestions.length > 0 && (_jsx("div", { className: "flex flex-wrap gap-1", children: issue.suggestions.slice(0, 6).map((suggestion) => (_jsx(Button, { type: "button", variant: "outline", size: "sm", disabled: !editable, className: "max-w-full", onClick: () => controller.apply(issue, suggestion), children: _jsx("span", { className: "truncate", children: suggestion || t("delete") }) }, suggestion))) })), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "min-w-0 flex-1 truncate text-cms-muted-foreground text-xs", children: checker?.label ?? issue.source }), issue.url && (_jsx("a", { href: issue.url, target: "_blank", rel: "noreferrer noopener", className: "text-cms-primary text-xs underline-offset-2 hover:underline", children: t("explain") })), _jsxs(Button, { type: "button", variant: "ghost", size: "sm", onClick: () => controller.ignore(issue), children: [_jsx(EyeOff, { "aria-hidden": true, className: "size-4" }), t("ignore")] })] })] }));
}
