"use client";
import { useCallback, useMemo } from "react";
import { runAiAction, runAiActionMany, streamAiAction, useAiActions } from "./ai-slot-provider.js";
/**
 * Calls an action of the site config (`aiPlugin({ actions })`) by name. Name, input and result types come from the config.
 *
 * ```ts
 * const summary = useAiAction("summary");
 * const result = await summary.run({ title, body }); // { kind: "text"; text: string }
 * ```
 */
export function useAiAction(key, enabled = true) {
    const { data } = useAiActions(enabled);
    const action = data?.items.find((item) => item.key === key);
    const available = Boolean(action?.enabled && data?.usable.includes(key));
    const run = useCallback((input, options) => runAiAction(key, input, options), [key]);
    const runMany = useCallback((inputs, options) => runAiActionMany(key, inputs, options), [key]);
    const stream = useCallback((input, options) => streamAiAction(key, input, options), [key]);
    return useMemo(() => ({ available, action, run, runMany, stream }), [available, action, run, runMany, stream]);
}
