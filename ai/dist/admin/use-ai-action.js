"use client";
import { useSite } from "@monti-cms/core/client";
import { useCallback, useMemo } from "react";
import { runAiAction, runAiActionMany, streamAiAction, useAiActions } from "./ai-slot-provider.js";
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
export function useAiAction(key, enabled = true) {
    const site = useSite();
    const { data } = useAiActions(enabled);
    const action = data?.items.find((item) => item.key === key);
    const available = Boolean(action?.enabled && data?.usable.includes(key));
    const run = useCallback((input, options) => runAiAction(site, key, input, options), [site, key]);
    const runMany = useCallback((inputs, options) => runAiActionMany(site, key, inputs, options), [site, key]);
    const stream = useCallback((input, options) => streamAiAction(site, key, input, options), [site, key]);
    return useMemo(() => ({ available, action, run, runMany, stream }), [available, action, run, runMany, stream]);
}
