import { cmsFetch } from "@monti-cms/admin/api";
import { cmsApiUrl, type Site } from "@monti-cms/core/client";
import type { AiActionView } from "../actions";
import type { AiCheckResult, AiModelInfo, AiSettingsView } from "../connection";
import type { AiRunResult } from "../definition";
import type { AiSharedView } from "../shared";

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
	shared: () => [...aiKeys.all, "shared"] as const,
	models: (source: ModelSource | null) => [...aiKeys.all, "models", source] as const,
};

const segment = (value: string) => encodeURIComponent(value);

/** `GET /v1/ai/actions` */
export const listAiActions = (site: Site, options: AiRequestOptions = {}) =>
	cmsFetch<AiActionsResponse>(site, cmsApiUrl("/v1/ai/actions"), options);

/** `POST /v1/ai/actions` (creates a screen action). */
export const createAiAction = (site: Site, json: unknown, fallback?: string) =>
	cmsFetch<AiActionView>(site, cmsApiUrl("/v1/ai/actions"), { method: "POST", json, fallback });

/** `PATCH /v1/ai/actions/:key` */
export const updateAiAction = (site: Site, key: string, json: unknown, fallback?: string) =>
	cmsFetch<AiActionView>(site, cmsApiUrl(`/v1/ai/actions/${segment(key)}`), { method: "PATCH", json, fallback });

/** `DELETE /v1/ai/actions/:key` */
export const deleteAiAction = (site: Site, key: string, expectedVersion: number, fallback?: string) =>
	cmsFetch(site, cmsApiUrl(`/v1/ai/actions/${segment(key)}?expectedVersion=${expectedVersion}`), {
		method: "DELETE",
		fallback,
	});

/** `GET /v1/ai/settings` */
export const getAiSettings = (site: Site, options: AiRequestOptions = {}) =>
	cmsFetch<AiSettingsView>(site, cmsApiUrl("/v1/ai/settings"), options);

/** `POST /v1/ai/providers` */
export const createAiProvider = (site: Site, json: unknown, fallback?: string) =>
	cmsFetch<AiSettingsView>(site, cmsApiUrl("/v1/ai/providers"), { method: "POST", json, fallback });

/** `PATCH /v1/ai/providers/:id` */
export const updateAiProvider = (site: Site, id: string, json: unknown, fallback?: string) =>
	cmsFetch<AiSettingsView>(site, cmsApiUrl(`/v1/ai/providers/${segment(id)}`), { method: "PATCH", json, fallback });

/** `DELETE /v1/ai/providers/:id` */
export const deleteAiProvider = (site: Site, id: string, expectedVersion: number, fallback?: string) =>
	cmsFetch<AiSettingsView>(site, cmsApiUrl(`/v1/ai/providers/${segment(id)}?expectedVersion=${expectedVersion}`), {
		method: "DELETE",
		fallback,
	});

/** `POST /v1/ai/providers/check` */
export const checkAiProvider = (site: Site, json: unknown, fallback?: string) =>
	cmsFetch<AiCheckResult>(site, cmsApiUrl("/v1/ai/providers/check"), { method: "POST", json, fallback });

/** `POST /v1/ai/models` */
export const listAiModels = (site: Site, source: ModelSource, options: AiRequestOptions = {}) =>
	cmsFetch<{ items: AiModelInfo[] }>(site, cmsApiUrl("/v1/ai/models"), { method: "POST", json: source, ...options });

/** `GET /v1/ai/shared` */
export const getAiShared = (site: Site, options: AiRequestOptions = {}) =>
	cmsFetch<AiSharedView>(site, cmsApiUrl("/v1/ai/shared"), options);

/** `POST /v1/ai/shared` */
export const createAiShared = (site: Site, json: unknown, fallback?: string) =>
	cmsFetch<AiSharedView>(site, cmsApiUrl("/v1/ai/shared"), { method: "POST", json, fallback });

/** `PATCH /v1/ai/shared` */
export const updateAiShared = (site: Site, json: unknown, fallback?: string) =>
	cmsFetch<AiSharedView>(site, cmsApiUrl("/v1/ai/shared"), { method: "PATCH", json, fallback });

/** `DELETE /v1/ai/shared?key=&expectedVersion=` */
export const deleteAiShared = (site: Site, key: string, expectedVersion: number, fallback?: string) =>
	cmsFetch<AiSharedView>(site, cmsApiUrl(`/v1/ai/shared?key=${segment(key)}&expectedVersion=${expectedVersion}`), {
		method: "DELETE",
		fallback,
	});

/** `POST /v1/ai/run` with one input. */
export const runAiOnce = (site: Pick<Site, "createTranslator">, json: unknown, options: AiRequestOptions) =>
	cmsFetch<{ result: AiRunResult }>(site, cmsApiUrl("/v1/ai/run"), { method: "POST", json, ...options });

/** `POST /v1/ai/run` with several inputs. */
export const runAiMany = (site: Pick<Site, "createTranslator">, json: unknown, options: AiRequestOptions) =>
	cmsFetch<{ results: AiRunManyResult[] }>(site, cmsApiUrl("/v1/ai/run"), { method: "POST", json, ...options });

/** `POST /v1/ai/run` as a stream: the raw response, which the caller reads line by line. */
export const openAiRunStream = (json: unknown, signal?: AbortSignal) =>
	fetch(cmsApiUrl("/v1/ai/run"), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(json),
		signal,
	});
