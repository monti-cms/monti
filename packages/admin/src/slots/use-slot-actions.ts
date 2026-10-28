"use client";

import { useTranslator } from "@monti-cms/core/site";
import { useCallback, useContext, useMemo, useRef, useState } from "react";
import { type EditorError, type EditorResult, editorFailure, toEditorError } from "../hooks/result";
import { useStoreSelector } from "../hooks/store";
import { slotsMessages } from "./messages";
import { type SlotAction, SlotRegistryContext, type SlotRequest, type SlotResult, SlotRunsContext } from "./registry";
import { createSlotRuns, IDLE, type RunState } from "./runs";

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
export type SlotActionView = Pick<SlotAction, "id" | "label" | "apply">;

/**
 * The run state of one slot.
 *
 * @experimental
 */
export type SlotRunState =
	| { status: "idle" }
	| { status: "running"; action: SlotActionView }
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
	/**
	 * Runs now and puts the result in through `options.apply` as soon as it arrives. Resolves when the run ends, with the result or with the error
	 * (`aborted` when it was cancelled or replaced by a newer run of the same slot; that case never lands in `state`).
	 */
	run(actionId: string): Promise<EditorResult<SlotResult>>;
	/** Aborts a running request and returns to `idle`. It also clears a failure. */
	cancel(): void;
}

const toView = (action: SlotAction): SlotActionView => ({ id: action.id, label: action.label, apply: action.apply });

function toPublicState(state: RunState): SlotRunState {
	return state.status === "idle" ? state : { ...state, action: toView(state.action) };
}

/** The values a result puts in: the text, the first candidate (`replace`) or every candidate (`append`). Empty when there is nothing for a field. */
function valuesOf(action: SlotAction, result: SlotResult): string[] {
	if (result.kind === "text") return result.text ? [result.text] : [];
	if (result.kind !== "candidates") return [];
	const values = result.items.map((item) => item.value).filter(Boolean);
	return action.apply === "append" ? values : values.slice(0, 1);
}

/**
 * The actions attached to one screen slot, with their run state, `run` and `cancel`. It returns state only, so a site can draw the trigger itself.
 * The default UI (`useSlot`) is built on it.
 *
 * A run puts its result in at once through `options.apply`. Run state lives in the slot registry, not in the component: it survives unmount, is
 * shared by every hook instance with the same `slot|target|collection|scope`, and a new run aborts the previous one of the same key.
 * `getContext()` is read when the run starts. Outside a `SlotRegistryProvider` the hook keeps its own run state and finds no actions.
 *
 * @experimental
 */
export function useSlotActions(options: SlotActionsOptions): SlotActionsState {
	const t = useTranslator(slotsMessages);
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

	const optionsRef = useRef(options);
	optionsRef.current = options;
	const actionsRef = useRef(actions);
	actionsRef.current = actions;

	// It does not stop even if the component disappears from the screen.
	const run = useCallback(
		async (actionId: string): Promise<EditorResult<SlotResult>> => {
			const found = actionsRef.current.find((candidate) => candidate.id === actionId);
			if (!found) return editorFailure("invalid_state", t("unknownAction"));
			const action = found;
			const controller = runs.begin(key);
			runs.set(key, { status: "running", action });
			try {
				const result = await action.run(optionsRef.current.getContext(), controller.signal);
				if (!runs.isCurrent(key, controller)) return editorFailure("aborted", t("cancelled"), true);
				const values = valuesOf(action, result);
				if (values.length === 0) {
					const error: EditorError = { code: "invalid_state", message: t("nothingToApply"), retryable: false };
					runs.set(key, { status: "error", action, error });
					return { ok: false, error };
				}
				for (const value of values) optionsRef.current.apply(value, action.apply);
				runs.set(key, IDLE);
				return { ok: true, value: result };
			} catch (thrown) {
				if (!runs.isCurrent(key, controller)) return editorFailure("aborted", t("cancelled"), true);
				const error = toEditorError(thrown, t("failed"));
				// A cancellation is not a failure: it goes back to idle instead of showing an error.
				runs.set(key, error.code === "aborted" ? IDLE : { status: "error", action, error });
				return { ok: false, error };
			}
		},
		[runs, key, t],
	);

	const cancel = useCallback(() => {
		runs.abort(key);
		runs.set(key, IDLE);
	}, [runs, key]);

	return {
		actions: views,
		disabled: Boolean(options.disabled) || state.status === "running",
		state,
		run,
		cancel,
	};
}
