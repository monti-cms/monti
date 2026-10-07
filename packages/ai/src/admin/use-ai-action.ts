"use client";

import { type AnyCmsConfig, useSite } from "@monti-cms/core/client";
import { useCallback, useMemo } from "react";
import type { AiActionView } from "../actions";
import type { AiActionInputOf, AiActionKey, AiActionResultOf } from "../registry";
import { type AiRunOptions, runAiAction, runAiActionMany, streamAiAction, useAiActions } from "./ai-slot-provider";

export interface UseAiAction<K extends AiActionKey<Config>, Config extends AnyCmsConfig = AnyCmsConfig> {
	/** Whether it is on and its connection is ready, so it can be called now. */
	available: boolean;
	/** Action definition and current values (name, ask-for-extra-request, etc.). Absent before the list is fetched. */
	action: AiActionView | undefined;
	run: (input: AiActionInputOf<K, Config>, options?: AiRunOptions) => Promise<AiActionResultOf<K, Config>>;
	/** Runs as a stream. Each time more text arrives, calls `onText` with all text received so far. */
	stream: (
		input: AiActionInputOf<K, Config>,
		options: AiRunOptions & { onText: (text: string) => void },
	) => Promise<AiActionResultOf<K, Config>>;
	/** Runs the same action over several inputs (up to 8 per request). Each input gets a result or a failure reason, in order. */
	runMany: (
		inputs: readonly AiActionInputOf<K, Config>[],
		options?: AiRunOptions,
	) => Promise<Array<{ result: AiActionResultOf<K, Config> } | { error: string }>>;
}

/**
 * Calls an action of the site config (`aiPlugin({ actions })`) by name. Called as it is, any name is accepted and an input is any input; `aiClient<typeof config>()`
 * gives the same hook with names, inputs and results typed by the config.
 *
 * ```ts
 * const { useAiAction } = aiClient<typeof config>();
 * const summary = useAiAction("summary");
 * const result = await summary.run({ title, body }); // { kind: "text"; text: string }
 * ```
 */
export function useAiAction<K extends AiActionKey<Config>, Config extends AnyCmsConfig = AnyCmsConfig>(
	key: K,
	enabled = true,
): UseAiAction<K, Config> {
	const site = useSite();
	const { data } = useAiActions(enabled);
	const action = data?.items.find((item) => item.key === key);
	const available = Boolean(action?.enabled && data?.usable.includes(key));
	const run = useCallback(
		(input: AiActionInputOf<K, Config>, options?: AiRunOptions) =>
			runAiAction(site, key, input as Record<string, unknown>, options) as Promise<AiActionResultOf<K, Config>>,
		[site, key],
	);
	const runMany = useCallback(
		(inputs: readonly AiActionInputOf<K, Config>[], options?: AiRunOptions) =>
			runAiActionMany(site, key, inputs as ReadonlyArray<Record<string, unknown>>, options) as Promise<
				Array<{ result: AiActionResultOf<K, Config> } | { error: string }>
			>,
		[site, key],
	);
	const stream = useCallback(
		(input: AiActionInputOf<K, Config>, options: AiRunOptions & { onText: (text: string) => void }) =>
			streamAiAction(site, key, input as Record<string, unknown>, options) as Promise<AiActionResultOf<K, Config>>,
		[site, key],
	);
	return useMemo(() => ({ available, action, run, runMany, stream }), [available, action, run, runMany, stream]);
}
