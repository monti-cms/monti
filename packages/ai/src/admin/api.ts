import { adminFetch } from "@monti-cms/admin/api";
import { adminApiUrl, type Site } from "@monti-cms/core/site";
import type { AiActionView } from "../actions";
import type { AiCheckResult, AiModelInfo, AiSettingsView } from "../connection";
import type { AiRunResult } from "../definition";
import type { AiSnippetView } from "../snippets";

/** Request options every function takes: cancellation, and the text for a failure the server gave no message for. */
export interface AiRequestOptions {
	signal?: AbortSignal;
	fallback?: string;
}

/** Where to fetch the model list from. A saved connection by id; before saving, by URL and key. */
export type ModelSource = { providerId: string } | { url: string; apiKey?: string; keyId?: string };

export interface AiActionsResponse {
	/** Names of actions that are ready to use now because their connection is ready. */
	usable: string[];
	items: AiActionView[];
}

export type AiRunManyResult = { result: AiRunResult } | { error: string };

export const aiKeys = {
	all: ["cms", "ai"] as const,
	actions: () => [...aiKeys.all, "actions"] as const,
	settings: () => [...aiKeys.all, "settings"] as const,
	snippets: () => [...aiKeys.all, "snippets"] as const,
	models: (source: ModelSource | null) => [...aiKeys.all, "models", source] as const,
};

const segment = (value: string) => encodeURIComponent(value);

/** `GET /v1/ai/actions` */
export const listAiActions = (site: Site, options: AiRequestOptions = {}) =>
	adminFetch<AiActionsResponse>(site, adminApiUrl("/v1/ai/actions"), options);

/** `POST /v1/ai/actions` (creates a screen action). */
export const createAiAction = (site: Site, json: unknown, fallback?: string) =>
	adminFetch<AiActionView>(site, adminApiUrl("/v1/ai/actions"), { method: "POST", json, fallback });

/** `PATCH /v1/ai/actions/:key` */
export const updateAiAction = (site: Site, key: string, json: unknown, fallback?: string) =>
	adminFetch<AiActionView>(site, adminApiUrl(`/v1/ai/actions/${segment(key)}`), { method: "PATCH", json, fallback });

/** `DELETE /v1/ai/actions/:key` */
export const deleteAiAction = (site: Site, key: string, expectedVersion: number, fallback?: string) =>
	adminFetch(site, adminApiUrl(`/v1/ai/actions/${segment(key)}?expectedVersion=${expectedVersion}`), {
		method: "DELETE",
		fallback,
	});

/** `GET /v1/ai/settings` */
export const getAiSettings = (site: Site, options: AiRequestOptions = {}) =>
	adminFetch<AiSettingsView>(site, adminApiUrl("/v1/ai/settings"), options);

/** `POST /v1/ai/providers` */
export const createAiProvider = (site: Site, json: unknown, fallback?: string) =>
	adminFetch<AiSettingsView>(site, adminApiUrl("/v1/ai/providers"), { method: "POST", json, fallback });

/** `PATCH /v1/ai/providers/:id` */
export const updateAiProvider = (site: Site, id: string, json: unknown, fallback?: string) =>
	adminFetch<AiSettingsView>(site, adminApiUrl(`/v1/ai/providers/${segment(id)}`), { method: "PATCH", json, fallback });

/** `DELETE /v1/ai/providers/:id` */
export const deleteAiProvider = (site: Site, id: string, expectedVersion: number, fallback?: string) =>
	adminFetch<AiSettingsView>(site, adminApiUrl(`/v1/ai/providers/${segment(id)}?expectedVersion=${expectedVersion}`), {
		method: "DELETE",
		fallback,
	});

/** `POST /v1/ai/providers/check` */
export const checkAiProvider = (site: Site, json: unknown, fallback?: string) =>
	adminFetch<AiCheckResult>(site, adminApiUrl("/v1/ai/providers/check"), { method: "POST", json, fallback });

/** `POST /v1/ai/models` */
export const listAiModels = (site: Site, source: ModelSource, options: AiRequestOptions = {}) =>
	adminFetch<{ items: AiModelInfo[] }>(site, adminApiUrl("/v1/ai/models"), {
		method: "POST",
		json: source,
		...options,
	});

/** `GET /v1/ai/snippets` */
export const getAiSnippets = (site: Site, options: AiRequestOptions = {}) =>
	adminFetch<AiSnippetView>(site, adminApiUrl("/v1/ai/snippets"), options);

/** `POST /v1/ai/snippets` */
export const createAiSnippet = (site: Site, json: unknown, fallback?: string) =>
	adminFetch<AiSnippetView>(site, adminApiUrl("/v1/ai/snippets"), { method: "POST", json, fallback });

/** `PATCH /v1/ai/snippets` */
export const updateAiSnippet = (site: Site, json: unknown, fallback?: string) =>
	adminFetch<AiSnippetView>(site, adminApiUrl("/v1/ai/snippets"), { method: "PATCH", json, fallback });

/** `DELETE /v1/ai/snippets?key=&expectedVersion=` */
export const deleteAiSnippet = (site: Site, key: string, expectedVersion: number, fallback?: string) =>
	adminFetch<AiSnippetView>(
		site,
		adminApiUrl(`/v1/ai/snippets?key=${segment(key)}&expectedVersion=${expectedVersion}`),
		{
			method: "DELETE",
			fallback,
		},
	);

/** `POST /v1/ai/run` with one input. */
export const runAiOnce = (site: Pick<Site, "createTranslator">, json: unknown, options: AiRequestOptions) =>
	adminFetch<{ result: AiRunResult }>(site, adminApiUrl("/v1/ai/run"), { method: "POST", json, ...options });

/** `POST /v1/ai/run` with several inputs. */
export const runAiMany = (site: Pick<Site, "createTranslator">, json: unknown, options: AiRequestOptions) =>
	adminFetch<{ results: AiRunManyResult[] }>(site, adminApiUrl("/v1/ai/run"), { method: "POST", json, ...options });

/** `POST /v1/ai/run` as a stream: the raw response, which the caller reads line by line. */
export const openAiRunStream = (json: unknown, signal?: AbortSignal) =>
	fetch(adminApiUrl("/v1/ai/run"), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(json),
		signal,
	});
