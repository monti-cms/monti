import type { AiActionView } from "../actions.js";
import type { AiActionInputOf, AiActionKey, AiActionResultOf } from "../registry.js";
import { type AiRunOptions } from "./ai-slot-provider.js";
export interface UseAiAction<K extends AiActionKey> {
    /** Whether it is on and its connection is ready, so it can be called now. */
    available: boolean;
    /** Action definition and current values (name, ask-for-extra-request, etc.). Absent before the list is fetched. */
    action: AiActionView | undefined;
    run: (input: AiActionInputOf<K>, options?: AiRunOptions) => Promise<AiActionResultOf<K>>;
    /** Runs as a stream. Each time more text arrives, calls `onText` with all text received so far. */
    stream: (input: AiActionInputOf<K>, options: AiRunOptions & {
        onText: (text: string) => void;
    }) => Promise<AiActionResultOf<K>>;
    /** Runs the same action over several inputs (up to 8 per request). Each input gets a result or a failure reason, in order. */
    runMany: (inputs: readonly AiActionInputOf<K>[], options?: AiRunOptions) => Promise<Array<{
        result: AiActionResultOf<K>;
    } | {
        error: string;
    }>>;
}
/**
 * Calls an action of the site config (`aiPlugin({ actions })`) by name. Name, input and result types come from the config.
 *
 * ```ts
 * const summary = useAiAction("summary");
 * const result = await summary.run({ title, body }); // { kind: "text"; text: string }
 * ```
 */
export declare function useAiAction<K extends AiActionKey>(key: K, enabled?: boolean): UseAiAction<K>;
