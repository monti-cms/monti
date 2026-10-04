"use client";
import { Fragment as _Fragment, jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { createTranslator } from "@monti-cms/core/client";
import { RefreshCw, X, Zap } from "lucide-react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, useSyncExternalStore, } from "react";
import { cn } from "../lib/utils/cn.js";
import { Button } from "../ui/button.js";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu.js";
import { IconButton } from "../ui/icon-button.js";
import { Spinner } from "../ui/spinner.js";
import { Textarea } from "../ui/textarea.js";
import { slotsMessages } from "./messages.js";
const t = createTranslator(slotsMessages);
/**
 * Screen slots. Named slots are placed throughout the CMS UI, and the actions attached to a slot are rendered as buttons.
 *
 * - A slot only passes the current context (`getContext`) and the apply function (`apply`). It does not know which actions are attached.
 * - Actions are decided by the sources in `SlotRegistryProvider`. AI features (the definitions on the admin AI screen) are one such source.
 * - An action does not change values itself. It shows results, and `apply` runs only when the user clicks a candidate.
 * - Run state (generating, results) is held by `SlotRegistryProvider`, not by the element that renders the slot. Closing a popover or panel
 *   does not stop the request, and reopening shows the same result. The same slot is distinguished by `scope` (entry, image, etc.).
 */
/**
 * Slot names used by the core. `field` is next to a field, `image` is a body image, `codeRules` is code block rules, `media` is media detail.
 * `translation` is the translation editor (block translation).
 */
export const CORE_SLOT_NAMES = ["field", "image", "codeRules", "media", "translation"];
const IDLE = { status: "idle" };
/** Icon used when an action does not provide one. */
const defaultIcon = _jsx(Zap, { "aria-hidden": true });
function createSlotRuns() {
    const states = new Map();
    const controllers = new Map();
    const listeners = new Map();
    return {
        get: (key) => states.get(key) ?? IDLE,
        set: (key, state) => {
            if (state.status === "idle")
                states.delete(key);
            else
                states.set(key, state);
            for (const listener of listeners.get(key) ?? [])
                listener();
        },
        subscribe: (key, listener) => {
            const set = listeners.get(key) ?? new Set();
            set.add(listener);
            listeners.set(key, set);
            return () => {
                set.delete(listener);
                if (set.size === 0)
                    listeners.delete(key);
            };
        },
        begin: (key) => {
            controllers.get(key)?.abort();
            const controller = new AbortController();
            controllers.set(key, controller);
            return controller;
        },
        abort: (key) => {
            controllers.get(key)?.abort();
            controllers.delete(key);
        },
        isCurrent: (key, controller) => controllers.get(key) === controller && !controller.signal.aborted,
    };
}
const SlotRegistryContext = createContext([]);
const SlotRunsContext = createContext(null);
export function SlotRegistryProvider({ sources, children }) {
    const parent = useContext(SlotRegistryContext);
    const value = useMemo(() => [...parent, ...sources], [parent, sources]);
    // Run state is held by a single outermost provider (one for the whole admin UI).
    const parentRuns = useContext(SlotRunsContext);
    const [ownRuns] = useState(() => (parentRuns ? null : createSlotRuns()));
    const runs = parentRuns ?? ownRuns;
    return (_jsx(SlotRunsContext.Provider, { value: runs, children: _jsx(SlotRegistryContext.Provider, { value: value, children: children }) }));
}
/** Shape of one result candidate. The AI screen's test results use the same shape. */
export const SLOT_CHIP = "inline-flex max-w-full items-center gap-1 rounded-full border bg-cms-background px-2 py-0.5";
const errorMessage = (error) => (error instanceof Error && error.message ? error.message : t("failed"));
/**
 * The button (`trigger`) and result panel (`panel`) of one slot. The button goes next to the label and the result below the input.
 * Both are `null` when no action is attached.
 */
export function useSlot(request) {
    const sources = useContext(SlotRegistryContext);
    const { slot, target, collection } = request;
    const actions = useMemo(() => sources.flatMap((source) => source({ slot, target, collection })), [sources, slot, target, collection]);
    // Outside a provider (tests, standalone screens), this element holds the run state.
    const [localRuns] = useState(createSlotRuns);
    const runs = useContext(SlotRunsContext) ?? localRuns;
    const key = `${slot}|${target}|${collection ?? ""}|${request.scope ?? ""}`;
    const state = useSyncExternalStore(useCallback((listener) => runs.subscribe(key, listener), [runs, key]), () => runs.get(key), () => IDLE);
    /** Extra request. It stays when running again in the same slot. */
    const [instruction, setInstruction] = useState("");
    const requestRef = useRef(request);
    requestRef.current = request;
    // It does not stop even if it disappears from the screen. The result stays in `runs` and shows when reopened.
    const run = useCallback(async (action, extra) => {
        const controller = runs.begin(key);
        runs.set(key, { status: "running", action });
        const context = requestRef.current.getContext();
        const request = action.askInstruction ? extra.trim() : "";
        try {
            const result = await action.run(request ? { ...context, request } : context, controller.signal);
            if (!runs.isCurrent(key, controller))
                return;
            const value = result.kind === "candidates" ? result.items[0]?.value : result.kind === "text" ? result.text : undefined;
            if (action.instant && action.apply !== "none" && value) {
                requestRef.current.apply(value, action.apply);
                runs.set(key, IDLE);
                return;
            }
            runs.set(key, { status: "done", action, result });
        }
        catch (error) {
            if (runs.isCurrent(key, controller))
                runs.set(key, { status: "error", action, message: errorMessage(error) });
        }
    }, [runs, key]);
    /** Button click. For an action that takes a request, opens the input first; otherwise runs immediately. */
    const start = (action) => {
        if (action.askInstruction) {
            runs.abort(key);
            runs.set(key, { status: "asking", action });
        }
        else
            void run(action, "");
    };
    const close = useCallback(() => {
        runs.abort(key);
        runs.set(key, IDLE);
    }, [runs, key]);
    /** Inserts the result. The same candidate can be inserted any number of times (clear, then insert again, etc.). */
    const applyValue = (value) => {
        if (state.status !== "done" || state.action.apply === "none")
            return;
        requestRef.current.apply(value, state.action.apply);
    };
    if (actions.length === 0)
        return { trigger: null, panel: null };
    const busy = state.status === "running";
    const disabled = request.disabled || busy;
    const first = actions[0];
    const triggerIcon = busy ? (_jsx(Spinner, { className: "size-3" })) : actions.length === 1 ? ((first?.icon ?? defaultIcon)) : ((first?.menuIcon ?? first?.icon ?? defaultIcon));
    const trigger = actions.length === 1 ? (_jsx(IconButton, { label: first?.label ?? "", size: "icon-xs", side: "bottom", disabled: disabled, onClick: () => actions[0] && start(actions[0]), className: "text-cms-muted-foreground hover:text-cms-foreground", children: triggerIcon })) : (_jsxs(DropdownMenu, { children: [_jsx(IconButton, { label: first?.menuLabel ?? first?.label ?? "", size: "icon-xs", side: "bottom", disabled: disabled, className: "text-cms-muted-foreground hover:text-cms-foreground", trigger: (button) => _jsx(DropdownMenuTrigger, { render: button }), children: triggerIcon }), _jsx(DropdownMenuContent, { align: "end", children: actions.map((action) => (_jsxs(DropdownMenuItem, { onClick: () => start(action), children: [action.icon ?? defaultIcon, action.label] }, action.id))) })] }));
    // While generating, it is shown by the button's spinning icon. The result panel opens only when a result or error appears or a request is taken.
    const panel = state.status === "idle" || (state.status === "running" && !state.action.askInstruction) ? null : (_jsxs("div", { className: "flex flex-col gap-1.5 rounded-md border bg-cms-muted/30 p-2 text-xs", "aria-live": "polite", children: [_jsxs("div", { className: "flex items-center gap-1 text-cms-muted-foreground", children: [_jsx("span", { className: "inline-flex shrink-0 items-center [&_svg]:size-3", children: state.action.icon ?? defaultIcon }), _jsx("span", { className: "truncate", children: state.action.label }), _jsxs("span", { className: "ml-auto flex items-center", children: [state.status !== "running" && state.status !== "asking" && (_jsx(IconButton, { label: t("rerun"), size: "icon-xs", onClick: () => void run(state.action, instruction), children: _jsx(RefreshCw, { "aria-hidden": true }) })), _jsx(IconButton, { label: t("close"), size: "icon-xs", onClick: close, children: _jsx(X, { "aria-hidden": true }) })] })] }), state.action.askInstruction && (_jsxs("form", { className: "flex flex-col gap-1.5", onSubmit: (event) => {
                    event.preventDefault();
                    if (state.status !== "running")
                        void run(state.action, instruction);
                }, children: [_jsx(Textarea, { "aria-label": t("instruction"), placeholder: t("instruction"), value: instruction, rows: 2, maxLength: 1000, autoFocus: state.status === "asking", disabled: state.status === "running", onChange: (event) => setInstruction(event.target.value), onKeyDown: (event) => {
                            // Keeps keys from leaking into the body even inside the editor. Enter is a newline; Cmd/Ctrl+Enter runs.
                            event.stopPropagation();
                            if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing) {
                                event.preventDefault();
                                if (state.status !== "running")
                                    void run(state.action, instruction);
                            }
                        }, className: "min-h-14 resize-y bg-cms-background text-xs md:text-xs" }), _jsxs(Button, { type: "submit", variant: "outline", size: "xs", className: "self-end", disabled: state.status === "running", children: [state.action.icon ?? defaultIcon, state.status === "running" ? t("running") : t("run")] })] })), state.status === "error" && (_jsx("p", { role: "alert", className: "text-cms-destructive", children: state.message })), state.status === "done" && _jsx(SlotResult, { state: state, onApply: applyValue })] }));
    return { trigger, panel };
}
function SlotResult({ state, onApply, }) {
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
