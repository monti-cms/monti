import { CmsError, type PluginCollection } from "@monti-cms/core/server";

/** Most conversations kept for one admin; the oldest go when a new one starts. */
export const MAX_RUNS_PER_ADMIN = 100;
/** Most a conversation stores: its messages as JSON text. A longer one is refused (the admin starts a new conversation). */
export const MAX_RUN_CHARS = 1_000_000;

export type AgentRunStatus = "running" | "done" | "failed" | "stopped";

/** Tokens a conversation has used, over all its requests. */
export interface AgentUsage {
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
}

export const NO_USAGE: AgentUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };

/** What is stored of a conversation (the times are the storage item's). */
export interface AgentRunValue {
	/** The admin who started it (`AuthContext.userId`). Only they can read it. */
	adminId: string;
	/** The first thing the admin asked, shortened: the line of the conversation list. */
	title: string;
	status: AgentRunStatus;
	/** The UI messages, as the panel holds them (tool calls and results included). */
	messages: unknown[];
	usage: AgentUsage;
	/** Why it failed, when it did. */
	error?: string;
}

export interface AgentRun extends AgentRunValue {
	id: string;
	createdAt: Date;
	updatedAt: Date;
}

export type AgentRunSummary = Omit<AgentRun, "messages" | "adminId">;

const keyOf = (adminId: string, id: string) => `${adminId}/${id}`;

const toRun = (item: { key: string; value: AgentRunValue; createdAt: Date; updatedAt: Date }): AgentRun => ({
	...item.value,
	// The key is `<admin id>/<run id>`, and an admin id may hold a `/` itself.
	id: item.key.slice(item.value.adminId.length + 1),
	createdAt: item.createdAt,
	updatedAt: item.updatedAt,
});

const TITLE_CHARS = 80;

/** The line of the conversation list: the first words of the first message of the admin. */
export function titleOf(messages: readonly unknown[]): string {
	const first = messages.find((message) => (message as { role?: unknown } | null)?.role === "user") as
		| { parts?: Array<{ type?: unknown; text?: unknown }> }
		| undefined;
	const text = (first?.parts ?? [])
		.flatMap((part) => (part.type === "text" && typeof part.text === "string" ? [part.text] : []))
		.join(" ")
		.replace(/\s+/g, " ")
		.trim();
	return text.length > TITLE_CHARS ? `${text.slice(0, TITLE_CHARS - 1)}…` : text;
}

/** Whether the messages fit what a conversation may store. */
export const fitsRun = (messages: readonly unknown[]): boolean => JSON.stringify(messages).length <= MAX_RUN_CHARS;

/** The conversations of the admin agent, in the AI plugin's storage. */
export function createAgentRunStore(collection: PluginCollection<AgentRunValue>) {
	const ownedBy = (adminId: string) => async () =>
		(await collection.list({ prefix: `${adminId}/` })).filter((item) => item.value.adminId === adminId);

	return {
		/** One conversation of this admin, or `null` (also for a conversation of another admin). */
		async get(adminId: string, id: string): Promise<AgentRun | null> {
			const item = await collection.get(keyOf(adminId, id));
			return item && item.value.adminId === adminId ? toRun(item) : null;
		},

		/** Starts a conversation, dropping this admin's oldest ones beyond {@link MAX_RUNS_PER_ADMIN}. */
		async create(id: string, value: AgentRunValue): Promise<AgentRun> {
			const owned = (await ownedBy(value.adminId)()).sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
			for (const old of owned.slice(0, Math.max(0, owned.length - (MAX_RUNS_PER_ADMIN - 1)))) {
				await collection.delete(old.key, { expectedVersion: old.version }).catch(() => undefined);
			}
			return toRun(await collection.set(keyOf(value.adminId, id), value, { expectedVersion: 0 }));
		},

		/** Replaces what is stored of a conversation. The last writer wins: one admin continues one conversation at a time. */
		async save(id: string, value: AgentRunValue): Promise<AgentRun> {
			const key = keyOf(value.adminId, id);
			for (let attempt = 0; ; attempt++) {
				const current = await collection.get(key);
				try {
					return toRun(await collection.set(key, value, { expectedVersion: current?.version ?? 0 }));
				} catch (error) {
					if (attempt >= 2 || !(error instanceof CmsError) || error.code !== "conflict") throw error;
				}
			}
		},

		/** This admin's conversations, newest first, one page. */
		async list(adminId: string, page: { page: number; pageSize: number }) {
			const owned = (await ownedBy(adminId)()).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
			const start = (page.page - 1) * page.pageSize;
			return {
				items: owned.slice(start, start + page.pageSize).map((item): AgentRunSummary => {
					const { messages: _messages, adminId: _adminId, ...summary } = toRun(item);
					return summary;
				}),
				total: owned.length,
				page: page.page,
				pageSize: page.pageSize,
			};
		},
	};
}

/** For each connection id, the models checked so far: `true` if the model called the check's tool, `false` if it did not (or the service said it cannot). */
export type ToolSupport = Record<string, Record<string, boolean>>;

/** What the connection check learned about tool calling, in the AI plugin's storage: one item per connection id. */
export function createToolSupportStore(collection: PluginCollection<Record<string, boolean>>) {
	return {
		async getToolSupport(): Promise<ToolSupport> {
			return Object.fromEntries((await collection.list()).map((item) => [item.key, item.value]));
		},

		async saveToolSupport(params: { providerId: string; model: string; supported: boolean }): Promise<void> {
			for (let attempt = 0; ; attempt++) {
				const current = await collection.get(params.providerId);
				try {
					await collection.set(
						params.providerId,
						{ ...current?.value, [params.model]: params.supported },
						{ expectedVersion: current?.version ?? 0 },
					);
					return;
				} catch (error) {
					if (attempt >= 2 || !(error instanceof CmsError) || error.code !== "conflict") throw error;
				}
			}
		},

		/** Forgets a connection's results: it was removed, or its address changed, so they may no longer hold. */
		async clearToolSupport(providerId: string): Promise<void> {
			const current = await collection.get(providerId);
			if (current) await collection.delete(providerId, { expectedVersion: current.version }).catch(() => undefined);
		},
	};
}
