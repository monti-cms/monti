"use client";
import { useTranslator } from "@monti-cms/core/client";
import { useCallback, useContext, useMemo, useRef, useState } from "react";
import { editorFailure, toEditorError } from "../hooks/result.js";
import { useStoreSelector } from "../hooks/store.js";
import { slotsMessages } from "./messages.js";
import { SlotRegistryContext, SlotRunsContext } from "./registry.js";
import { createSlotRuns, IDLE } from "./runs.js";
const toView = (action) => ({
    id: action.id,
    label: action.label,
    icon: action.icon,
    menuLabel: action.menuLabel,
    menuIcon: action.menuIcon,
    apply: action.apply,
    askInstruction: action.askInstruction,
    instant: action.instant,
});
function toPublicState(state) {
    return state.status === "idle" ? state : { ...state, action: toView(state.action) };
}
const OK = { ok: true, value: undefined };
/**
 * The actions attached to one screen slot, with their run state, result, `run`, `cancel` and `apply`. It returns state and results only,
 * so a site can draw the trigger and the panel itself. The default UI (`useSlot`) is built on it.
 *
 * Run state lives in the slot registry, not in the component: it survives unmount, is shared by every hook instance with the same
 * `slot|target|collection|scope`, and a new run aborts the previous one of the same key. `getContext()` is read when the run starts.
 * Outside a `SlotRegistryProvider` the hook keeps its own run state and finds no actions.
 *
 * @experimental
 */
export function useSlotActions(options) {
    const t = useTranslator(slotsMessages);
    const sources = useContext(SlotRegistryContext);
    const { slot, target, collection } = options;
    const actions = useMemo(() => sources.flatMap((source) => source({ slot, target, collection })), [sources, slot, target, collection]);
    const views = useMemo(() => actions.map(toView), [actions]);
    // Outside a provider (tests, standalone screens), this element holds the run state.
    const [localRuns] = useState(createSlotRuns);
    const runs = useContext(SlotRunsContext) ?? localRuns;
    const key = `${slot}|${target}|${collection ?? ""}|${options.scope ?? ""}`;
    const internal = useStoreSelector(runs.store, (store) => store.runs[key] ?? IDLE);
    const state = useMemo(() => toPublicState(internal), [internal]);
    const [instruction, setInstructionState] = useState("");
    const instructionRef = useRef(instruction);
    instructionRef.current = instruction;
    const setInstruction = useCallback((text) => {
        instructionRef.current = text;
        setInstructionState(text);
    }, []);
    const optionsRef = useRef(options);
    optionsRef.current = options;
    const actionsRef = useRef(actions);
    actionsRef.current = actions;
    // It does not stop even if the component disappears from the screen. The result stays in `runs` and shows when reopened.
    const execute = useCallback(async (action, extra) => {
        const controller = runs.begin(key);
        runs.set(key, { status: "running", action });
        try {
            const context = optionsRef.current.getContext();
            const request = action.askInstruction ? extra.trim() : "";
            const result = await action.run(request ? { ...context, request } : context, controller.signal);
            if (!runs.isCurrent(key, controller))
                return editorFailure("aborted", t("cancelled"), true);
            const value = result.kind === "candidates" ? result.items[0]?.value : result.kind === "text" ? result.text : undefined;
            if (action.instant && action.apply !== "none" && value) {
                optionsRef.current.apply(value, action.apply);
                runs.set(key, IDLE);
            }
            else
                runs.set(key, { status: "done", action, result });
            return { ok: true, value: result };
        }
        catch (thrown) {
            if (!runs.isCurrent(key, controller))
                return editorFailure("aborted", t("cancelled"), true);
            const error = toEditorError(thrown, t("failed"));
            // A cancellation is not a failure: it goes back to idle instead of showing an error.
            runs.set(key, error.code === "aborted" ? IDLE : { status: "error", action, error });
            return { ok: false, error };
        }
    }, [runs, key, t]);
    /** The action to run: one attached to the slot now, or the one the panel is showing (so a run survives a source change). */
    const resolve = useCallback((actionId) => {
        const found = actionsRef.current.find((action) => action.id === actionId);
        if (found)
            return found;
        const current = runs.get(key);
        return current.status !== "idle" && current.action.id === actionId ? current.action : undefined;
    }, [runs, key]);
    const run = useCallback((actionId, runOptions) => {
        const action = resolve(actionId);
        if (!action)
            return Promise.resolve(editorFailure("invalid_state", t("unknownAction")));
        return execute(action, runOptions?.instruction ?? instructionRef.current);
    }, [resolve, execute, t]);
    const start = useCallback((actionId) => {
        const action = resolve(actionId);
        if (!action)
            return;
        if (action.askInstruction) {
            runs.abort(key);
            runs.set(key, { status: "asking", action });
        }
        else
            void execute(action, "");
    }, [resolve, execute, runs, key]);
    const rerun = useCallback(() => {
        const current = runs.get(key);
        if (current.status !== "done" && current.status !== "error")
            return Promise.resolve(editorFailure("invalid_state", t("nothingToRerun")));
        return execute(current.action, instructionRef.current);
    }, [runs, key, execute, t]);
    const cancel = useCallback(() => {
        runs.abort(key);
        runs.set(key, IDLE);
    }, [runs, key]);
    /** Inserts the result. The same candidate can be inserted any number of times (clear, then insert again, etc.). */
    const apply = useCallback((value) => {
        const current = runs.get(key);
        if (current.status !== "done" || current.action.apply === "none")
            return editorFailure("invalid_state", t("nothingToApply"));
        optionsRef.current.apply(value, current.action.apply);
        return OK;
    }, [runs, key, t]);
    return {
        actions: views,
        disabled: Boolean(options.disabled) || state.status === "running",
        state,
        instruction,
        setInstruction,
        start,
        run,
        rerun,
        cancel,
        apply,
    };
}
