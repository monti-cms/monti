import { randomUUID } from "node:crypto";
import { type AdminRequest, type Cms, pluginLog } from "@monti-cms/core/server";
import {
	convertToModelMessages,
	createUIMessageStreamResponse,
	isStepCount,
	type LanguageModelUsage,
	streamText,
	toUIMessageStream,
	type UIMessage,
	type UIMessageChunk,
} from "ai";
import { agentMessages } from "./agent.messages";
import { withAgentRetry } from "./agent-model";
import { agentSystemPrompt } from "./agent-prompt";
import type { AgentRequest } from "./agent-request";
import { type AgentRunStatus, type AgentRunValue, type AgentUsage, fitsRun, NO_USAGE, titleOf } from "./agent-store";
import { createAgentTools } from "./agent-tools";
import { AiError } from "./errors";
import { AI_PLUGIN_NAME } from "./name";
import { modelFailureMessage } from "./provider";
import { type AgentRuntime, noToolsError } from "./settings";
import type { AiStore } from "./store";

const log = pluginLog(AI_PLUGIN_NAME);

/** Most model requests (steps) one request of the agent makes. */
export const MAX_AGENT_STEPS = 12;

/** What the panel reads from the answer's messages: the conversation to continue, and what it has used so far. */
export interface AgentMessageMetadata {
	runId: string;
	/** Tokens of the whole conversation up to the end of this request. Sent with the last chunk. */
	usage?: AgentUsage;
}

export type AgentMessage = UIMessage<AgentMessageMetadata>;

const usageOf = (usage: LanguageModelUsage): AgentUsage => ({
	inputTokens: usage.inputTokens ?? 0,
	outputTokens: usage.outputTokens ?? 0,
	totalTokens: usage.totalTokens ?? (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
});

const addUsage = (a: AgentUsage, b: AgentUsage): AgentUsage => ({
	inputTokens: a.inputTokens + b.inputTokens,
	outputTokens: a.outputTokens + b.outputTokens,
	totalTokens: a.totalTokens + b.totalTokens,
});

/** The conversation kept to what a stored run may hold: the oldest messages go first. */
function fitted(messages: AgentMessage[]): AgentMessage[] {
	let kept = messages;
	while (kept.length > 1 && !fitsRun(kept)) kept = kept.slice(1);
	return kept;
}

/**
 * Reads a UI message stream up to the first chunk after its preamble (`start`, `start-step`), where a request that the model refused shows itself.
 * Returns the stream again with what was read put back in front, so nothing is lost.
 */
async function pastPreamble(stream: ReadableStream<UIMessageChunk>): Promise<ReadableStream<UIMessageChunk>> {
	const reader = stream.getReader();
	const read: UIMessageChunk[] = [];
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		read.push(value);
		if (value.type !== "start" && value.type !== "start-step") break;
	}
	return new ReadableStream<UIMessageChunk>({
		start(controller) {
			for (const chunk of read) controller.enqueue(chunk);
		},
		async pull(controller) {
			const { done, value } = await reader.read();
			if (done) controller.close();
			else controller.enqueue(value);
		},
		cancel: (reason) => reader.cancel(reason),
	});
}

export interface StartAgentRun {
	readonly cms: Cms;
	readonly auth: AdminRequest["auth"];
	readonly store: AiStore;
	readonly runtime: AgentRuntime;
	readonly body: AgentRequest;
	readonly signal?: AbortSignal;
}

/**
 * Runs the agent for one request and answers with the AI SDK's UI message stream. The conversation is stored when it starts and again when it ends
 * (`done`, `failed` when the model could not be reached, `stopped` when the request was cancelled), so a closed panel can come back to it.
 *
 * A model that was never checked for tool calling is tried: if the service answers that it cannot, that is stored and the request is refused like a model
 * known not to. The first model request of the stream is awaited for this, so the refusal is a plain error answer, not a failed stream.
 */
export async function startAgentRun({ cms, auth, store, runtime, body, signal }: StartAgentRun): Promise<Response> {
	const { site } = cms;
	const t = site.createTranslator(agentMessages);
	const messages = body.messages as unknown as AgentMessage[];
	if (!fitsRun(messages)) throw new AiError("payload_too_large", t("runTooLong"), { fix: t("runTooLong.fix") });

	const existing = body.runId ? await store.agentRuns.get(auth.userId, body.runId) : null;
	if (body.runId && !existing) throw new AiError("not_found", t("unknownRun"));
	const runId = existing?.id ?? randomUUID();
	const before = existing?.usage ?? NO_USAGE;
	const title = existing?.title ?? titleOf(messages);

	let failure: string | undefined;
	let unsupported = false;
	let usage = before;
	// The conversation is stored before the stream is sent. The end of the stream waits for that, and for the answer to the question below.
	let release: (kept: boolean) => void = () => {};
	const kept = new Promise<boolean>((resolve) => {
		release = resolve;
	});

	const save = (status: AgentRunStatus, all: unknown[]) => {
		const value: AgentRunValue = {
			adminId: auth.userId,
			title,
			status,
			messages: all,
			usage,
			...(failure ? { error: failure } : {}),
		};
		return store.agentRuns.save(runId, value);
	};

	const tools = await createAgentTools({ cms, auth, signal, entryId: body.context.entryId });
	const result = streamText({
		model: withAgentRetry(runtime.model, {
			onToolsUnsupported: () => {
				unsupported = true;
			},
		}),
		system: agentSystemPrompt(site, body.context),
		messages: await convertToModelMessages(messages, { tools, ignoreIncompleteToolCalls: true }),
		tools,
		stopWhen: isStepCount(MAX_AGENT_STEPS),
		// The retry of a failed request is the model wrapper's (once per step), not the SDK's.
		maxRetries: 0,
		abortSignal: signal,
	});

	const ui = toUIMessageStream<typeof tools, AgentMessage>({
		stream: result.stream,
		tools,
		originalMessages: messages,
		messageMetadata: ({ part }) => {
			if (part.type === "start") return { runId };
			if (part.type === "finish") {
				usage = addUsage(before, usageOf(part.totalUsage));
				return { runId, usage };
			}
			return undefined;
		},
		onError: (error) => {
			failure = modelFailureMessage(error);
			log.warn(`agent run ${runId} failed: ${failure}`);
			return failure;
		},
		onEnd: async ({ messages: all, outcome, isAborted, isCancelled }) => {
			if (!(await kept)) return;
			const status: AgentRunStatus = failure
				? "failed"
				: isAborted || isCancelled || outcome.status === "aborted"
					? "stopped"
					: "done";
			await save(status, fitted(all)).catch((error) => log.error("could not store agent run", runId, error));
		},
	});

	// A model never checked is tried: look at the start of its answer before committing to a stream.
	const stream = runtime.tools === null ? await pastPreamble(ui) : ui;
	if (unsupported) {
		release(false);
		stream.cancel().catch(() => undefined);
		await runtime.rememberTools(false).catch((error) => log.error("could not store tool support", error));
		throw noToolsError(site, runtime.modelName);
	}

	try {
		await (existing
			? save("running", messages)
			: store.agentRuns.create(runId, { adminId: auth.userId, title, status: "running", messages, usage }));
	} catch (error) {
		release(false);
		stream.cancel().catch(() => undefined);
		throw error;
	}
	release(true);
	return createUIMessageStreamResponse({ stream });
}
