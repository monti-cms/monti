import type { EditorError } from "../hooks/result.js";
import { type StateStore } from "../hooks/store.js";
import type { SlotAction, SlotResult } from "./registry.js";
/** Run state of one slot, with the full action (the hook hands out a view without `run`). */
export type RunState = {
    status: "idle";
} | {
    status: "asking";
    action: SlotAction;
} | {
    status: "running";
    action: SlotAction;
} | {
    status: "done";
    action: SlotAction;
    result: SlotResult;
} | {
    status: "error";
    action: SlotAction;
    error: EditorError;
};
export declare const IDLE: RunState;
interface RunsState {
    runs: Readonly<Record<string, RunState>>;
}
/** Per-slot run state, keyed by `slot|target|collection|scope`. It persists even after the UI fragment disappears. */
export interface SlotRuns {
    store: StateStore<RunsState>;
    get: (key: string) => RunState;
    set: (key: string, state: RunState) => void;
    /** Starts a new run. Stops the previous run of the same slot. */
    begin: (key: string) => AbortController;
    /** Stops the run of the same slot. */
    abort: (key: string) => void;
    /** Whether this run is still the latest run of that slot. */
    isCurrent: (key: string, controller: AbortController) => boolean;
}
export declare function createSlotRuns(): SlotRuns;
export {};
