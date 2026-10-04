import { z } from "zod";
import type { AiInputKind } from "./action.js";
import type { AiModelInfo } from "./connection.js";
import type { AiResult } from "./definition.js";
/**
 * AI service port. Built from a connection (URL, key) and one model. The connection comes from the AI screen settings (`settings.ts`).
 *
 * - Generate: calls an OpenAI-style URL through the Vercel AI SDK. Receives the answer in a fixed JSON shape.
 * - Decide: receives a probability per option from a System One URL (TypeSafe `/v1/systemone`, OpenRouter Decisions API).
 * - Fake: with `CMS_AI_FAKE=1` (dev only), gives a fixed answer without a key.
 */
export type AiContent = {
    type: "text";
    text: string;
} | {
    type: "image";
    mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
    data: string;
};
/** Material from which the fake connection (dev only) builds its answer. Real connections do not read it. */
export interface AiFakeHint {
    /** Material sent (input name -> kind, text). */
    readonly inputs: Readonly<Record<string, {
        readonly kind: AiInputKind;
        readonly value: string;
    }>>;
    /** Selectable values (candidates with options). */
    readonly choices?: readonly string[];
    /** Fake answer defined by the action (`AiActionDefinition.fake`). */
    readonly answer?: () => string;
}
export interface AiRequest<T> {
    system: string;
    content: AiContent[];
    schema: z.ZodType<T>;
    maxTokens: number;
    /** Result shape. The fake connection uses it to decide the answer shape. */
    result: AiResult;
    fake: AiFakeHint;
    signal?: AbortSignal;
}
/** Streaming request. Only text (MDX, long text) results are streamed. The answer is plain text, not JSON. */
export type AiStreamRequest = Omit<AiRequest<unknown>, "schema">;
export interface AiProvider {
    readonly name: "openai-compatible" | "fake";
    readonly model: string;
    generate<T>(request: AiRequest<T>): Promise<T>;
    /** Streams the answer piece by piece. Ends once everything is received. */
    stream(request: AiStreamRequest): AsyncIterable<string>;
}
export type DecisionQuestion = {
    type: "noul";
    instructions: string;
    criteria?: {
        true: string;
        false: string;
    };
} | {
    type: "choice";
    instructions: string;
    criteria: Record<string, string>;
};
export type DecisionAnswer = {
    type: "noul";
    noul: number;
} | {
    type: "choice";
    choice: string;
    probabilities: Record<string, number>;
};
export interface DecisionRequest {
    state: Record<string, string>;
    questions: Record<string, DecisionQuestion>;
    signal?: AbortSignal;
}
export interface AiDecider {
    readonly name: "decisions" | "fake";
    readonly model: string;
    decide(request: DecisionRequest): Promise<Record<string, DecisionAnswer>>;
}
export declare const isFakeAi: () => boolean;
export declare function createGenerator(config: {
    baseUrl: string;
    apiKey: string;
    model: string;
}): AiProvider;
export declare function createDecider(config: {
    url: string;
    apiKey: string;
    model: string;
}): AiDecider;
/** Model list of an OpenAI-style URL (`GET {baseUrl}/models`). Empty array for services that do not provide a list. */
export declare function listModels(baseUrl: string, apiKey: string | null, signal?: AbortSignal): Promise<AiModelInfo[]>;
/** Generation model that gives a fixed answer without a key. The same input always gives the same answer. */
export declare function createFakeGenerator(): AiProvider;
/** Decision model that gives fixed probabilities without a key. The earlier the option, the higher the probability. */
export declare function createFakeDecider(): AiDecider;
