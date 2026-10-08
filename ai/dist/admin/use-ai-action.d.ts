import { type AnyCmsConfig } from "@monti-cms/core/client";
import type { AiActionView } from "../actions.js";
import type { AiActionInputOf, AiActionKey, AiActionResultOf } from "../registry.js";
import { type AiRunOptions } from "./ai-slot-provider.js";
export interface UseAiAction<K extends AiActionKey<Config>, Config extends AnyCmsConfig = AnyCmsConfig> {
    /** Whether it is on and its connection is ready, so it can be called now. */
    available: boolean;
    /** Action definition and current values (name, ask-for-extra-request, etc.). Absent before the list is fetched. */
    action: AiActionView | undefined;
    run: (input: AiActionInputOf<K, Config>, options?: AiRunOptions) => Promise<AiActionResultOf<K, Config>>;
    /** Runs as a stream. Each time more text arrives, calls `onText` with all text received so far. */
    stream: (input: AiActionInputOf<K, Config>, options: AiRunOptions & {
        onText: (text: string) => void;
    }) => Promise<AiActionResultOf<K, Config>>;
    /** Runs the same action over several inputs (up to 8 per request). Each input gets a result or a failure reason, in order. */
    runMany: (inputs: readonly AiActionInputOf<K, Config>[], options?: AiRunOptions) => Promise<Array<{
        result: AiActionResultOf<K, Config>;
    } | {
        error: string;
    }>>;
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
export declare function useAiAction<K extends AiActionKey<Config>, Config extends AnyCmsConfig = AnyCmsConfig>(key: K, enabled?: boolean): UseAiAction<K, Config>;
