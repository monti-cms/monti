"use client";

import { createTranslator } from "@monti-cms/core/client";
import { useCallback, useContext, useMemo, useRef, useState } from "react";
import { type EditorError, type EditorResult, editorFailure, toEditorError } from "../hooks/result";
import { useStoreSelector } from "../hooks/store";
import { slotsMessages } from "./messages";
import { type SlotAction, SlotRegistryContext, type SlotRequest, type SlotResult, SlotRunsContext } from "./registry";
import { createSlotRuns, IDLE, type RunState } from "./runs";

const t = createTranslator(slotsMessages);

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
export type SlotActionView = Pick<
	SlotAction,
	"id" | "label" | "icon" | "menuLabel" | "menuIcon" | "apply" | "askInstruction" | "instant"
>;

/**
 * The run state of one slot.
 *
 * @experimental
 */
export type SlotRunState =
	| { status: "idle" }
	/** Waiting for the extra instruction. */
	| { status: "asking"; action: SlotActionView }
	| { status: "running"; action: SlotActionView }
	| { status: "done"; action: SlotActionView; result: SlotResult }
	| { status: "error"; action: SlotActionView; error: EditorError };

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
	run(actionId: string, options?: { instruction?: string }): Promise<EditorResult<SlotResult>>;
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

const toView = (action: SlotAction): SlotActionView => ({
	id: action.id,
	label: action.label,
	icon: action.icon,
	menuLabel: action.menuLabel,
	menuIcon: action.menuIcon,
	apply: action.apply,
	askInstruction: action.askInstruction,
	instant: action.instant,
});

function toPublicState(state: RunState): SlotRunState {
	return state.status === "idle" ? state : { ...state, action: toView(state.action) };
}

const OK: EditorResult = { ok: true, value: undefined };

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
export function useSlotActions(options: SlotActionsOptions): SlotActionsState {
	const sources = useContext(SlotRegistryContext);
	const { slot, target, collection } = options;
	const actions = useMemo(
		() => sources.flatMap((source) => source({ slot, target, collection })),
		[sources, slot, target, collection],
	);
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
	const setInstruction = useCallback((text: string) => {
		instructionRef.current = text;
		setInstructionState(text);
	}, []);
	const optionsRef = useRef(options);
	optionsRef.current = options;
	const actionsRef = useRef(actions);
	actionsRef.current = actions;

	// It does not stop even if the component disappears from the screen. The result stays in `runs` and shows when reopened.
	const execute = useCallback(
		async (action: SlotAction, extra: string): Promise<EditorResult<SlotResult>> => {
			const controller = runs.begin(key);
			runs.set(key, { status: "running", action });
			try {
				const context = optionsRef.current.getContext();
				const request = action.askInstruction ? extra.trim() : "";
				const result = await action.run(request ? { ...context, request } : context, controller.signal);
				if (!runs.isCurrent(key, controller)) return editorFailure("aborted", t("cancelled"), true);
				const value =
					result.kind === "candidates" ? result.items[0]?.value : result.kind === "text" ? result.text : undefined;
				if (action.instant && action.apply !== "none" && value) {
					optionsRef.current.apply(value, action.apply);
					runs.set(key, IDLE);
				} else runs.set(key, { status: "done", action, result });
				return { ok: true, value: result };
			} catch (thrown) {
				if (!runs.isCurrent(key, controller)) return editorFailure("aborted", t("cancelled"), true);
				const error = toEditorError(thrown, t("failed"));
				// A cancellation is not a failure: it goes back to idle instead of showing an error.
				runs.set(key, error.code === "aborted" ? IDLE : { status: "error", action, error });
				return { ok: false, error };
			}
		},
		[runs, key],
	);

	/** The action to run: one attached to the slot now, or the one the panel is showing (so a run survives a source change). */
	const resolve = useCallback(
		(actionId: string) => {
			const found = actionsRef.current.find((action) => action.id === actionId);
			if (found) return found;
			const current = runs.get(key);
			return current.status !== "idle" && current.action.id === actionId ? current.action : undefined;
		},
		[runs, key],
	);

	const run = useCallback(
		(actionId: string, runOptions?: { instruction?: string }): Promise<EditorResult<SlotResult>> => {
			const action = resolve(actionId);
			if (!action) return Promise.resolve(editorFailure("invalid_state", t("unknownAction")));
			return execute(action, runOptions?.instruction ?? instructionRef.current);
		},
		[resolve, execute],
	);

	const start = useCallback(
		(actionId: string) => {
			const action = resolve(actionId);
			if (!action) return;
			if (action.askInstruction) {
				runs.abort(key);
				runs.set(key, { status: "asking", action });
			} else void execute(action, "");
		},
		[resolve, execute, runs, key],
	);

	const rerun = useCallback((): Promise<EditorResult<SlotResult>> => {
		const current = runs.get(key);
		if (current.status !== "done" && current.status !== "error")
			return Promise.resolve(editorFailure("invalid_state", t("nothingToRerun")));
		return execute(current.action, instructionRef.current);
	}, [runs, key, execute]);

	const cancel = useCallback(() => {
		runs.abort(key);
		runs.set(key, IDLE);
	}, [runs, key]);

	/** Inserts the result. The same candidate can be inserted any number of times (clear, then insert again, etc.). */
	const apply = useCallback(
		(value: string): EditorResult => {
			const current = runs.get(key);
			if (current.status !== "done" || current.action.apply === "none")
				return editorFailure("invalid_state", t("nothingToApply"));
			optionsRef.current.apply(value, current.action.apply);
			return OK;
		},
		[runs, key],
	);

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
