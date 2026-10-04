"use client";

import { useCallback, useMemo } from "react";
import type { AiActionView } from "../actions";
import type { AiActionInputOf, AiActionKey, AiActionResultOf } from "../registry";
import { type AiRunOptions, runAiAction, runAiActionMany, streamAiAction, useAiActions } from "./ai-slot-provider";

export interface UseAiAction<K extends AiActionKey> {
	/** Whether it is on and its connection is ready, so it can be called now. */
	available: boolean;
	/** Action definition and current values (name, ask-for-extra-request, etc.). Absent before the list is fetched. */
	action: AiActionView | undefined;
	run: (input: AiActionInputOf<K>, options?: AiRunOptions) => Promise<AiActionResultOf<K>>;
	/** Runs as a stream. Each time more text arrives, calls `onText` with all text received so far. */
	stream: (
		input: AiActionInputOf<K>,
		options: AiRunOptions & { onText: (text: string) => void },
	) => Promise<AiActionResultOf<K>>;
	/** Runs the same action over several inputs (up to 8 per request). Each input gets a result or a failure reason, in order. */
	runMany: (
		inputs: readonly AiActionInputOf<K>[],
		options?: AiRunOptions,
	) => Promise<Array<{ result: AiActionResultOf<K> } | { error: string }>>;
}

/**
 * Calls an action of the site config (`aiPlugin({ actions })`) by name. Name, input and result types come from the config.
 *
 * ```ts
 * const summary = useAiAction("summary");
 * const result = await summary.run({ title, body }); // { kind: "text"; text: string }
 * ```
 */
export function useAiAction<K extends AiActionKey>(key: K, enabled = true): UseAiAction<K> {
	const { data } = useAiActions(enabled);
	const action = data?.items.find((item) => item.key === key);
	const available = Boolean(action?.enabled && data?.usable.includes(key));
	const run = useCallback(
		(input: AiActionInputOf<K>, options?: AiRunOptions) =>
			runAiAction(key, input as Record<string, unknown>, options) as Promise<AiActionResultOf<K>>,
		[key],
	);
	const runMany = useCallback(
		(inputs: readonly AiActionInputOf<K>[], options?: AiRunOptions) =>
			runAiActionMany(key, inputs as ReadonlyArray<Record<string, unknown>>, options) as Promise<
				Array<{ result: AiActionResultOf<K> } | { error: string }>
			>,
		[key],
	);
	const stream = useCallback(
		(input: AiActionInputOf<K>, options: AiRunOptions & { onText: (text: string) => void }) =>
			streamAiAction(key, input as Record<string, unknown>, options) as Promise<AiActionResultOf<K>>,
		[key],
	);
	return useMemo(() => ({ available, action, run, runMany, stream }), [available, action, run, runMany, stream]);
}
