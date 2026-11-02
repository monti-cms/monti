import { adminApiUrl, adminFetch, type Site } from "@monti-cms/admin";
import type { AiActionView } from "../actions";
import type { AgentModelChoice, AiModelChoice, AiModelInfo, AiSettingsView } from "../connection";
import type { AiRunResult } from "../definition";

/** Request options every function takes: cancellation, and the text for a failure the server gave no message for. */
export interface AiRequestOptions {
	signal?: AbortSignal;
	fallback?: string;
}

export interface AiActionsResponse {
	/** Names of actions that are ready to use now because their connection is ready. */
	usable: string[];
	items: AiActionView[];
}

export type AiRunManyResult = { result: AiRunResult } | { error: string };

/** A conversation of the admin agent in the list, as `GET /v1/ai/agent/runs` sends it (the times are text). */
export interface AgentRunView {
	id: string;
	title: string;
	status: "running" | "done" | "failed" | "stopped";
	usage: { inputTokens: number; outputTokens: number; totalTokens: number };
	/** The model it ran on last. */
	model?: AgentModelChoice;
	error?: string;
	createdAt: string;
	updatedAt: string;
}

/** One conversation with its messages, as `GET /v1/ai/agent/runs/:id` sends it. */
export interface AgentRunDetail extends AgentRunView {
	messages: unknown[];
}

export const aiKeys = {
	all: ["cms", "ai"] as const,
	agentRuns: () => [...aiKeys.all, "agent-runs"] as const,
	actions: () => [...aiKeys.all, "actions"] as const,
	settings: () => [...aiKeys.all, "settings"] as const,
	models: (keyId: string) => [...aiKeys.all, "models", keyId] as const,
};

const segment = (value: string) => encodeURIComponent(value);

/** `GET /v1/ai/actions` */
export const listAiActions = (site: Site, options: AiRequestOptions = {}) =>
	adminFetch<AiActionsResponse>(site, "/v1/ai/actions", options);

/** `GET /v1/ai/settings` */
export const getAiSettings = (site: Site, options: AiRequestOptions = {}) =>
	adminFetch<AiSettingsView>(site, "/v1/ai/settings", options);

/** `PUT /v1/ai/settings`: chooses the quick-task model. */
export const setAiQuickModel = (
	site: Site,
	json: { expectedVersion: number; quick: AiModelChoice },
	fallback?: string,
) => adminFetch<AiSettingsView>(site, "/v1/ai/settings", { method: "PUT", json, fallback });

/** `GET /v1/ai/agent/runs`: the newest conversations of the signed-in admin. */
export const listAgentRuns = (site: Site, options: AiRequestOptions = {}) =>
	adminFetch<{ items: AgentRunView[]; total: number }>(site, "/v1/ai/agent/runs?pageSize=20", options);

/** `GET /v1/ai/agent/runs/:id` */
export const getAgentRun = (site: Site, id: string, options: AiRequestOptions = {}) =>
	adminFetch<AgentRunDetail>(site, `/v1/ai/agent/runs/${segment(id)}`, options);

/** `POST /v1/ai/models`: the models of one AI key. */
export const listAiModels = (site: Site, keyId: string, options: AiRequestOptions = {}) =>
	adminFetch<{ items: AiModelInfo[] }>(site, "/v1/ai/models", {
		method: "POST",
		json: { keyId },
		...options,
	});

/** `POST /v1/ai/run` with one input. */
export const runAiOnce = (site: Pick<Site, "createTranslator">, json: unknown, options: AiRequestOptions) =>
	adminFetch<{ result: AiRunResult }>(site, "/v1/ai/run", { method: "POST", json, ...options });

/** `POST /v1/ai/run` with several inputs. */
export const runAiMany = (site: Pick<Site, "createTranslator">, json: unknown, options: AiRequestOptions) =>
	adminFetch<{ results: AiRunManyResult[] }>(site, "/v1/ai/run", { method: "POST", json, ...options });

/** `POST /v1/ai/run` as a stream: the raw response, which the caller reads line by line. */
export const openAiRunStream = (json: unknown, signal?: AbortSignal) =>
	fetch(adminApiUrl("/v1/ai/run"), {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(json),
		signal,
	});
