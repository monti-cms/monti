import type { EditorError } from "../hooks/result";
import { createStateStore, type StateStore } from "../hooks/store";
import type { SlotAction, SlotResult } from "./registry";

/** Run state of one slot, with the full action (the hook hands out a view without `run`). */
export type RunState =
	| { status: "idle" }
	| { status: "asking"; action: SlotAction }
	| { status: "running"; action: SlotAction }
	| { status: "done"; action: SlotAction; result: SlotResult }
	| { status: "error"; action: SlotAction; error: EditorError };

export const IDLE: RunState = { status: "idle" };

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

export function createSlotRuns(): SlotRuns {
	const store = createStateStore<RunsState>({ runs: {} });
	const controllers = new Map<string, AbortController>();
	const get = (key: string) => store.getState().runs[key] ?? IDLE;
	return {
		store,
		get,
		set: (key, state) => {
			if (state.status === "idle" && !(key in store.getState().runs)) return;
			store.setState(({ runs }) => {
				const { [key]: _previous, ...rest } = runs;
				return { runs: state.status === "idle" ? rest : { ...rest, [key]: state } };
			});
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
