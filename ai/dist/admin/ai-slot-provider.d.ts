import { type ReactNode } from "react";
import type { AiActionView } from "../actions.js";
import type { AiRunContext, AiRunResult } from "../definition.js";
export declare const AI_ACTIONS_KEY: readonly ["cms", "ai", "actions"];
export interface AiActionsResponse {
    /** Names of actions that are ready to use now because their connection is ready. */
    usable: string[];
    items: AiActionView[];
}
export declare function useAiActions(enabled?: boolean): import("@tanstack/react-query").UseQueryResult<AiActionsResponse, Error>;
/** Common information of a run request (outside the input). */
export interface AiRunEnv {
    collection?: string;
    locale?: string;
    entryId?: string;
    language?: string;
}
export interface AiRunOptions {
    env?: AiRunEnv;
    /** Extra request entered at run time. */
    request?: string;
    /** Unsaved edited values (Test in the AI screen). */
    draft?: unknown;
    /** Unsaved basic info of a screen action (testing a new action). */
    draftBase?: unknown;
    signal?: AbortSignal;
}
/** Runs an action by name. */
export declare function runAiAction(action: string, input: Readonly<Record<string, unknown>>, options?: AiRunOptions): Promise<AiRunResult>;
/**
 * Runs an action as a stream. Each time more text arrives, calls `onText` with all text received so far,
 * and when done returns the result that passed the checks.
 */
export declare function streamAiAction(action: string, input: Readonly<Record<string, unknown>>, options: AiRunOptions & {
    onText: (text: string) => void;
}): Promise<AiRunResult>;
/** Runs the same action over several inputs (up to 8 per request). Each input gets a result or a failure reason, in order. */
export declare function runAiActionMany(action: string, inputs: ReadonlyArray<Readonly<Record<string, unknown>>>, options?: AiRunOptions): Promise<Array<{
    result: AiRunResult;
} | {
    error: string;
}>>;
/** Converts the current state of a slot into action inputs and common information. Sends only the inputs present in the action definition. */
export declare function inputFromContext(action: Pick<AiActionView, "input">, context: AiRunContext): {
    input: Record<string, unknown>;
    env: AiRunEnv;
};
/**
 * Attaches AI actions to screen slots. Among enabled actions, those whose attach target (`attach`) is this slot are attached as buttons.
 * An action is not attached if the connection it uses is not ready.
 */
export declare function AiSlotProvider({ children }: {
    children: ReactNode;
}): import("react").JSX.Element;
