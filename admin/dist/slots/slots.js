"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { RefreshCw, X, Zap } from "lucide-react";
import { cn } from "../lib/utils/cn.js";
import { Button } from "../ui/button.js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu.js";
import { IconButton } from "../ui/icon-button.js";
import { Spinner } from "../ui/spinner.js";
import { Textarea } from "../ui/textarea.js";
import { slotsMessages } from "./messages.js";
import { useSlotActions } from "./use-slot-actions.js";
export { CORE_SLOT_NAMES, SlotRegistryProvider, } from "./registry.js";
/**
 * Screen slots (default UI). The registry, the types and the run state live in `registry.tsx` and `use-slot-actions.ts`;
 * this file draws the button and the result panel on top of `useSlotActions`.
 */
/** Icon used when an action does not provide one. */
const defaultIcon = _jsx(Zap, { "aria-hidden": true });
/** Shape of one result candidate. The AI screen's test results use the same shape. */
export const SLOT_CHIP = "inline-flex max-w-full items-center gap-1 rounded-full border bg-cms-background px-2 py-0.5";
/**
 * The button (`trigger`) and result panel (`panel`) of one slot. The button goes next to the label and the result below the input.
 * Both are `null` when no action is attached.
 */
export function useSlot(request) {
    const t = useTranslator(slotsMessages);
    const { actions, disabled, state, instruction, setInstruction, start, run, rerun, cancel, apply } = useSlotActions(request);
    if (actions.length === 0)
        return { trigger: null, panel: null };
    const busy = state.status === "running";
    const first = actions[0];
    const triggerIcon = busy ? (_jsx(Spinner, { className: "size-3" })) : actions.length === 1 ? ((first?.icon ?? defaultIcon)) : ((first?.menuIcon ?? first?.icon ?? defaultIcon));
    const trigger = actions.length === 1 ? (_jsx(IconButton, { label: first?.label ?? "", size: "icon-xs", side: "bottom", disabled: disabled, onClick: () => first && start(first.id), className: "text-cms-muted-foreground hover:text-cms-foreground", children: triggerIcon })) : (_jsxs(DropdownMenu, { children: [_jsx(IconButton, { label: first?.menuLabel ?? first?.label ?? "", size: "icon-xs", side: "bottom", disabled: disabled, className: "text-cms-muted-foreground hover:text-cms-foreground", trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: triggerIcon }), _jsx(DropdownMenuContent, { align: "end", children: actions.map((action) => (_jsxs(DropdownMenuItem, { onClick: () => start(action.id), children: [action.icon ?? defaultIcon, action.label] }, action.id))) })] }));
    // While generating, it is shown by the button's spinning icon. The result panel opens only when a result or error appears or a request is taken.
    const panel = state.status === "idle" || (state.status === "running" && !state.action.askInstruction) ? null : (_jsxs("div", { className: "flex flex-col gap-1.5 rounded-md border bg-cms-muted/30 p-2 text-xs", "aria-live": "polite", children: [_jsxs("div", { className: "flex items-center gap-1 text-cms-muted-foreground", children: [_jsx("span", { className: "inline-flex shrink-0 items-center [&_svg]:size-3", children: state.action.icon ?? defaultIcon }), _jsx("span", { className: "truncate", children: state.action.label }), _jsxs("span", { className: "ml-auto flex items-center", children: [state.status !== "running" && state.status !== "asking" && (_jsx(IconButton, { label: t("rerun"), size: "icon-xs", onClick: () => void rerun(), children: _jsx(RefreshCw, { "aria-hidden": true }) })), _jsx(IconButton, { label: t("close"), size: "icon-xs", onClick: cancel, children: _jsx(X, { "aria-hidden": true }) })] })] }), state.action.askInstruction && (_jsxs("form", { className: "flex flex-col gap-1.5", onSubmit: (event) => {
                    event.preventDefault();
                    if (state.status !== "running")
                        void run(state.action.id);
                }, children: [_jsx(Textarea, { "aria-label": t("instruction"), placeholder: t("instruction"), value: instruction, rows: 2, maxLength: 1000, autoFocus: state.status === "asking", disabled: state.status === "running", onChange: (event) => setInstruction(event.target.value), onKeyDown: (event) => {
                            // Keeps keys from leaking into the body even inside the editor. Enter is a newline; Cmd/Ctrl+Enter runs.
                            event.stopPropagation();
                            if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
                                event.preventDefault();
                                if (state.status !== "running")
                                    void run(state.action.id);
                            }
                        }, className: "min-h-14 resize-y bg-cms-background text-xs md:text-xs" }), _jsxs(Button, { type: "submit", variant: "outline", size: "xs", className: "self-end", disabled: state.status === "running", children: [state.action.icon ?? defaultIcon, state.status === "running" ? t("running") : t("run")] })] })), state.status === "error" && (_jsx("p", { role: "alert", className: "text-cms-destructive", children: state.error.message })), state.status === "done" && _jsx(SlotResult, { state: state, onApply: apply })] }));
    return { trigger, panel };
}
function SlotResult({ state, onApply, }) {
    const t = useTranslator(slotsMessages);
    const { result, action } = state;
    if (result.kind === "candidates") {
        if (result.items.length === 0)
            return _jsx("p", { className: "text-cms-muted-foreground", children: t("noResults") });
        return (_jsx("ul", { className: "flex flex-wrap gap-1", children: result.items.map((item) => (_jsx("li", { className: "max-w-full", children: _jsxs("button", { type: "button", onClick: () => onApply(item.value), title: item.label, className: cn(SLOT_CHIP, "text-left hover:bg-cms-accent"), children: [_jsx("span", { className: "truncate", children: item.label }), item.detail && _jsx("span", { className: "shrink-0 text-cms-muted-foreground", children: item.detail })] }) }, item.value))) }));
    }
    return (_jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("p", { className: "whitespace-pre-wrap rounded border bg-cms-background p-2", children: result.text }), result.kind === "text" && action.apply !== "none" && (_jsx(Button, { type: "button", size: "xs", variant: "outline", className: "self-start", onClick: () => onApply(result.text), children: action.apply === "append" ? t("insert") : t("replace") }))] }));
}
/** Wrapper for using slots inside loops and conditions. Run state is kept per `request.scope`. */
export function SlotScope({ request, children, }) {
    return _jsx(_Fragment, { children: children(useSlot(request)) });
}
