import type { Site } from "@monti-cms/core/client";
import { type AiContentLookup, type AiRunEnv, type ResolvedAiAction } from "./action.js";
import { type AiRunResult } from "./definition.js";
import type { AiContent, AiDecider, AiProvider } from "./provider.js";
/**
 * AI action runner. Reads an action definition (inputs, instructions, result, validators), gathers the material to send, gets the answer the way the mode requires, and validates it.
 * No code differs per action. A new action only needs a definition.
 *
 * - Generate: sends the instructions and material to the chat model and receives the result in the result shape (candidates, text, MDX, note).
 * - Decide: receives a probability per option and keeps only those at or above the threshold probability, highest first, as candidates.
 */
/** Max body length (characters) that can be sent at once. Longer input is rejected, not truncated. */
export declare const MAX_AI_BODY_CHARS = 60000;
export interface AiOption {
    value: string;
    label: string;
}
export interface AiRunDeps {
    /** The site the action runs for: its locales, admin language and AI settings. */
    site: Site;
    /** Generation model. `null` when not connected. */
    generator: AiProvider | null;
    /** Decision model. `null` when not connected. */
    decider: AiDecider | null;
    /** Selectable items of the collection (all published ones). */
    loadRecords: (collection: string) => Promise<AiOption[]>;
    /** Options of a select field. Empty array if none. */
    fieldOptions: (collection: string, field: string) => AiOption[];
    /** Image (media ID or site URL). `null` if it cannot be read or is not an image. */
    loadImage: (image: {
        mediaId?: string;
        src?: string;
    }) => Promise<{
        mediaType: Extract<AiContent, {
            type: "image";
        }>["mediaType"];
        data: string;
    } | null>;
    /** Main content lookup. Received by code validators (`AiValidatorContext.content`). */
    content: AiContentLookup;
    /** Locale code -> name written in that language (language input of the instructions). */
    languageName: (code: string) => string;
    /** Shared texts (with edited values applied). Fills `{{shared.name}}` in the instructions. */
    shared?: Readonly<Record<string, string>>;
    signal?: AbortSignal;
}
/** Input and shared information for one run. */
export interface AiCall {
    readonly input: Readonly<Record<string, unknown>>;
    readonly env: AiRunEnv;
    /** Extra request entered at run time. */
    readonly request?: string;
}
export declare function runAiAction(action: ResolvedAiAction, call: AiCall, deps: AiRunDeps): Promise<AiRunResult>;
/**
 * Strips an MDX code fence (```mdx … ```, or a fence without a language) wrapped around the whole answer. Keeps only the body even if the model breaks the rule.
 * Fences of other languages (e.g. ```mermaid) are code blocks in the body and are left as they are.
 */
export declare const unfence: (text: string) => string;
/**
 * Streaming run. Passes text/MDX results to `onDelta` piece by piece and, once everything is received, returns the result after the same validation as a normal run.
 * If validation fails, the received text is discarded and it is an error.
 */
export declare function streamAiAction(action: ResolvedAiAction, call: AiCall, deps: AiRunDeps, onDelta: (text: string) => void): Promise<AiRunResult>;
