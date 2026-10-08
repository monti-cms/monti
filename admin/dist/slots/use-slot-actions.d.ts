import { type EditorError, type EditorResult } from "../hooks/result.js";
import { type SlotAction, type SlotRequest, type SlotResult } from "./registry.js";
/**
 * Options of {@link useSlotActions}: the slot, its target, the context to read on run and the function that applies a value.
 *
 * @experimental
 */
export type SlotActionsOptions = SlotRequest;
/**
 * What a UI needs to draw an action. The action's `run` stays inside the registry.
 *
 * @experimental
 */
export type SlotActionView = Pick<SlotAction, "id" | "label" | "icon" | "menuLabel" | "menuIcon" | "apply" | "askInstruction" | "instant">;
/**
 * The run state of one slot.
 *
 * @experimental
 */
export type SlotRunState = {
    status: "idle";
}
/** Waiting for the extra instruction. */
 | {
    status: "asking";
    action: SlotActionView;
} | {
    status: "running";
    action: SlotActionView;
} | {
    status: "done";
    action: SlotActionView;
    result: SlotResult;
} | {
    status: "error";
    action: SlotActionView;
    error: EditorError;
};
/**
 * What {@link useSlotActions} returns.
 *
 * @experimental
 */
export interface SlotActionsState {
    /** Actions attached to this slot now (empty: render nothing). Action ids are unique per slot. */
    actions: readonly SlotActionView[];
    /** `options.disabled`, and also true while running, so a button can reuse it. */
    disabled: boolean;
    state: SlotRunState;
    /** Extra instruction typed for the next run. Kept between runs in the same hook instance. */
    instruction: string;
    setInstruction(text: string): void;
    /** What a button click does: asks for the instruction first when the action has `askInstruction`, otherwise runs. */
    start(actionId: string): void;
    /**
     * Runs now. `instruction` defaults to the current `instruction` state. Resolves when the run ends: with the result, or with the
     * error (`aborted` when it was cancelled or replaced by a newer run of the same slot; that case never lands in `state`).
     * An `instant` action applies its first candidate and goes back to `idle`.
     */
    run(actionId: string, options?: {
        instruction?: string;
    }): Promise<EditorResult<SlotResult>>;
    /** Runs the action of the current `done` or `error` state again. */
    rerun(): Promise<EditorResult<SlotResult>>;
    /** Aborts a running or asking request and returns to `idle`. It also closes a `done` or `error` result. */
    cancel(): void;
    /**
     * Applies one value (a candidate's `value`, or the text of a `text` result) through `options.apply` with the action's mode.
     * Fails with `invalid_state` when there is no `done` result or the action only displays.
     */
    apply(value: string): EditorResult;
}
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
export declare function useSlotActions(options: SlotActionsOptions): SlotActionsState;
