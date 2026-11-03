import { adminApiUrl, adminFetch, type Site } from "@monti-cms/admin";
import type { AiActionView } from "../actions";
import type { EditorProposalView, EditorSettlement } from "../agent/entry-proposals";
import type { RunOutcome } from "../agent/outcome";
import type { ProgressLine } from "../agent/progress";
import type { ProposalView } from "../agent/proposal-view";
import type { AgentModelChoice, AiModelChoice, AiModelInfo, AiSettingsView, UnopenedDays } from "../connection";
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
	/** When it was last opened from the past conversations. */
	openedAt?: string;
	/** What came of it (its latest proposal), when it proposed something. */
	outcome?: RunOutcome;
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
	proposal: (id: string) => [...aiKeys.all, "proposal", id] as const,
	entryProposals: (entryId: string) => [...aiKeys.all, "entry-proposals", entryId] as const,
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

/** `PUT /v1/ai/settings`: how long a conversation nobody opened is kept. */
export const setUnopenedDays = (
	site: Site,
	json: { expectedVersion: number; unopenedDays: UnopenedDays },
	fallback?: string,
) => adminFetch<AiSettingsView>(site, "/v1/ai/settings", { method: "PUT", json, fallback });

/** `GET /v1/ai/agent/runs`: the conversations of the signed-in admin, the last used first. */
export const listAgentRuns = (site: Site, options: AiRequestOptions = {}) =>
	adminFetch<{ items: AgentRunView[]; total: number }>(site, "/v1/ai/agent/runs?pageSize=50", options);

/** `DELETE /v1/ai/agent/runs/:id` */
export const deleteAgentRun = (site: Site, id: string, fallback?: string) =>
	adminFetch<{ deleted: true }>(site, `/v1/ai/agent/runs/${segment(id)}`, { method: "DELETE", fallback });

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

/** `GET /v1/ai/proposals/:id`: a proposal, with the items whose target changed since marked stale. */
export const getProposal = (site: Site, id: string, options: AiRequestOptions = {}) =>
	adminFetch<ProposalView>(site, `/v1/ai/proposals/${segment(id)}`, options);

/** `PATCH /v1/ai/proposals/:id`: puts items in or leaves them out. */
export const includeProposalItems = (site: Site, id: string, include: Record<string, boolean>, fallback?: string) =>
	adminFetch<ProposalView>(site, `/v1/ai/proposals/${segment(id)}`, { method: "PATCH", json: { include }, fallback });

/** `GET /v1/ai/proposals?entry=`: the body changes waiting for one entry, for its editor. */
export const listEntryProposals = (site: Site, entryId: string, options: AiRequestOptions = {}) =>
	adminFetch<{ items: EditorProposalView[] }>(site, `/v1/ai/proposals?entry=${segment(entryId)}`, options);

/** `POST /v1/ai/proposals/:id/items/:itemId/ask`: the assistant writes one body change again; the change that took its place (`null`: none any more). */
export const askProposalItem = (site: Site, id: string, itemId: string, text: string, fallback?: string) =>
	adminFetch<{ item: EditorProposalView | null }>(
		site,
		`/v1/ai/proposals/${segment(id)}/items/${segment(itemId)}/ask`,
		{
			method: "POST",
			json: { text },
			fallback,
		},
	);

/** `POST /v1/ai/spots`: the assistant writes the block that holds selected words again, as a proposal of its own (`null`: nothing to propose). */
export const askAtSelection = (site: Site, entry: string, words: string, text: string, fallback?: string) =>
	adminFetch<{ item: EditorProposalView | null }>(site, "/v1/ai/spots", {
		method: "POST",
		json: { entry, words, text },
		fallback,
	});

/** `POST /v1/ai/proposals/:id/settle`: what the admin accepted (and saved) and discarded in the editor. */
export const settleProposal = (site: Site, id: string, settlement: EditorSettlement, fallback?: string) =>
	adminFetch<ProposalView>(site, `/v1/ai/proposals/${segment(id)}/settle`, {
		method: "POST",
		json: settlement,
		fallback,
	});

/** `POST /v1/ai/proposals/:id/discard` */
export const discardProposal = (site: Site, id: string, fallback?: string) =>
	adminFetch<ProposalView>(site, `/v1/ai/proposals/${segment(id)}/discard`, { method: "POST", fallback });

/**
 * `POST /v1/ai/proposals/:id/apply` or `…/revert`: runs it and reads the answer line by line, calling `onProgress` for each step. Resolves with the proposal at
 * the end; a failure of the whole run rejects with its message.
 */
export async function runProposal(
	id: string,
	action: "apply" | "revert",
	onProgress: (done: number, total: number) => void,
	fallback: string,
): Promise<ProposalView> {
	const response = await fetch(adminApiUrl(`/v1/ai/proposals/${segment(id)}/${action}`), {
		method: "POST",
		credentials: "same-origin",
	});
	if (!response.ok || !response.body) throw new Error(fallback);
	const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
	let buffer = "";
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		buffer += value;
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";
		for (const line of lines) {
			if (!line.trim()) continue;
			const parsed = JSON.parse(line) as ProgressLine;
			if (parsed.type === "progress") onProgress(parsed.done, parsed.total);
			else if (parsed.type === "done") return parsed.proposal;
			else throw new Error(parsed.message || fallback);
		}
	}
	throw new Error(fallback);
}
