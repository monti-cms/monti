import { type Site } from "@monti-cms/admin";
import type { AiActionView } from "../actions.js";
import type { AiCheckResult, AiModelInfo, AiSettingsView } from "../connection.js";
import type { AiRunResult } from "../definition.js";
import type { AiSnippetView } from "../snippets.js";
/** Request options every function takes: cancellation, and the text for a failure the server gave no message for. */
export interface AiRequestOptions {
    signal?: AbortSignal;
    fallback?: string;
}
/** Where to fetch the model list from. A saved connection by id; before saving, by URL and key. */
export type ModelSource = {
    providerId: string;
} | {
    url: string;
    apiKey?: string;
    keyId?: string;
};
export interface AiActionsResponse {
    /** Names of actions that are ready to use now because their connection is ready. */
    usable: string[];
    items: AiActionView[];
}
export type AiRunManyResult = {
    result: AiRunResult;
} | {
    error: string;
};
export declare const aiKeys: {
    all: readonly ["cms", "ai"];
    actions: () => readonly ["cms", "ai", "actions"];
    settings: () => readonly ["cms", "ai", "settings"];
    snippets: () => readonly ["cms", "ai", "snippets"];
    models: (source: ModelSource | null) => readonly ["cms", "ai", "models", ModelSource | null];
};
/** `GET /v1/ai/actions` */
export declare const listAiActions: (site: Site, options?: AiRequestOptions) => Promise<AiActionsResponse>;
/** `POST /v1/ai/actions` (creates a screen action). */
export declare const createAiAction: (site: Site, json: unknown, fallback?: string) => Promise<AiActionView>;
/** `PATCH /v1/ai/actions/:key` */
export declare const updateAiAction: (site: Site, key: string, json: unknown, fallback?: string) => Promise<AiActionView>;
/** `DELETE /v1/ai/actions/:key` */
export declare const deleteAiAction: (site: Site, key: string, expectedVersion: number, fallback?: string) => Promise<unknown>;
/** `GET /v1/ai/settings` */
export declare const getAiSettings: (site: Site, options?: AiRequestOptions) => Promise<AiSettingsView>;
/** `POST /v1/ai/providers` */
export declare const createAiProvider: (site: Site, json: unknown, fallback?: string) => Promise<AiSettingsView>;
/** `PATCH /v1/ai/providers/:id` */
export declare const updateAiProvider: (site: Site, id: string, json: unknown, fallback?: string) => Promise<AiSettingsView>;
/** `DELETE /v1/ai/providers/:id` */
export declare const deleteAiProvider: (site: Site, id: string, expectedVersion: number, fallback?: string) => Promise<AiSettingsView>;
/** `POST /v1/ai/providers/check` */
export declare const checkAiProvider: (site: Site, json: unknown, fallback?: string) => Promise<AiCheckResult>;
/** `POST /v1/ai/models` */
export declare const listAiModels: (site: Site, source: ModelSource, options?: AiRequestOptions) => Promise<{
    items: AiModelInfo[];
}>;
/** `GET /v1/ai/snippets` */
export declare const getAiSnippets: (site: Site, options?: AiRequestOptions) => Promise<AiSnippetView>;
/** `POST /v1/ai/snippets` */
export declare const createAiSnippet: (site: Site, json: unknown, fallback?: string) => Promise<AiSnippetView>;
/** `PATCH /v1/ai/snippets` */
export declare const updateAiSnippet: (site: Site, json: unknown, fallback?: string) => Promise<AiSnippetView>;
/** `DELETE /v1/ai/snippets?key=&expectedVersion=` */
export declare const deleteAiSnippet: (site: Site, key: string, expectedVersion: number, fallback?: string) => Promise<AiSnippetView>;
/** `POST /v1/ai/run` with one input. */
export declare const runAiOnce: (site: Pick<Site, "createTranslator">, json: unknown, options: AiRequestOptions) => Promise<{
    result: AiRunResult;
}>;
/** `POST /v1/ai/run` with several inputs. */
export declare const runAiMany: (site: Pick<Site, "createTranslator">, json: unknown, options: AiRequestOptions) => Promise<{
    results: AiRunManyResult[];
}>;
/** `POST /v1/ai/run` as a stream: the raw response, which the caller reads line by line. */
export declare const openAiRunStream: (json: unknown, signal?: AbortSignal) => Promise<Response>;
