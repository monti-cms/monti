"use client";

import { type UseChatHelpers, useChat } from "@ai-sdk/react";
import {
	adminApiUrl,
	apiErrorOf,
	type OpenEditor,
	type ScreenContextValue,
	useOpenEditor,
	useScreenContext,
	useSite,
	useTranslator,
} from "@monti-cms/admin";
import { DefaultChatTransport, getToolName, isToolUIPart, type UIMessage } from "ai";
import { useCallback, useMemo, useRef, useState } from "react";
import type { AgentUsage } from "../agent-store";
import { answerEditorTool, isEditorTool } from "./agent-editor-tools";
import { agentPanelMessages } from "./agent-panel.messages";
import { useMdxFormat } from "./mdx-format";

/** What the server puts on a message of its answer: the conversation it belongs to, and what the conversation has used so far. */
export interface AgentMessageMetadata {
	readonly runId?: string;
	readonly usage?: AgentUsage;
}

export type AgentMessage = UIMessage<AgentMessageMetadata>;

/** The last tool calls of the assistant's message are all answered, and the browser answered at least one: the run goes on with those answers. */
export function editorToolsAnswered({ messages }: { messages: UIMessage[] }): boolean {
	const last = messages.at(-1);
	if (last?.role !== "assistant") return false;
	const stepStart = last.parts.map((part) => part.type).lastIndexOf("step-start");
	const calls = last.parts.slice(stepStart + 1).filter(isToolUIPart);
	return (
		calls.length > 0 &&
		calls.every((call) => call.state === "output-available" || call.state === "output-error") &&
		calls.some((call) => isEditorTool(getToolName(call)))
	);
}

/** The conversation the messages belong to, from the last answer that says so. */
export const runIdOf = (messages: readonly AgentMessage[]): string | undefined =>
	messages.findLast((message) => message.metadata?.runId)?.metadata?.runId;

/** What the conversation has used, from the last answer that says so (the server adds up the requests of a conversation). */
export const usageOf = (messages: readonly AgentMessage[]): AgentUsage | undefined =>
	messages.findLast((message) => message.metadata?.usage)?.metadata?.usage;

export interface AgentChat extends UseChatHelpers<AgentMessage> {
	/** The conversation the messages belong to; `undefined` before the first answer of a new one. */
	readonly runId: string | undefined;
	readonly usage: AgentUsage | undefined;
	/** Continues a stored conversation, with its stored messages. */
	readonly reopen: (id: string, stored: unknown[]) => void;
	/** Starts a new conversation. */
	readonly reset: () => void;
}

/**
 * The conversation with the assistant: `useChat` over `POST /v1/ai/agent`, sending where the admin is with each request. The two editor tools the server
 * declares while an entry is open are answered here, from the editor on screen. `reopen` continues a stored conversation; `reset` starts a new one.
 */
export function useAgentChat(): AgentChat {
	const site = useSite();
	const t = useTranslator(agentPanelMessages);
	const screen = useScreenContext();
	const openEditor = useOpenEditor();
	const format = useMdxFormat();
	const [openedRunId, setOpenedRunId] = useState<string>();

	// What a request and an answer to a tool read when they happen, not when the hook last rendered.
	const latest = useRef<{
		screen: ScreenContextValue;
		openEditor: OpenEditor | null;
		runId: string | undefined;
		format: typeof format;
		noEditor: string;
	}>({ screen, openEditor, runId: undefined, format, noEditor: t("tool.noEditor") });
	latest.current = { ...latest.current, screen, openEditor, format, noEditor: t("tool.noEditor") };
	const answer = useRef<(args: { tool: string; toolCallId: string; output?: unknown; errorText?: string }) => void>(
		() => undefined,
	);

	const transport = useMemo(
		() =>
			new DefaultChatTransport<AgentMessage>({
				api: adminApiUrl("/v1/ai/agent"),
				// A refused request is an ordinary error answer: keep its code (`service_unavailable`, `agent_unavailable`), which the panel tells apart.
				fetch: async (input, init) => {
					const response = await fetch(input, init);
					if (response.ok) return response;
					const body = await response
						.clone()
						.json()
						.catch(() => ({}));
					throw apiErrorOf(site, response.status, body, "");
				},
				prepareSendMessagesRequest: ({ messages }) => {
					const { screen: where, runId } = latest.current;
					const { screen: name, collection, entryId, selectedIds } = where;
					return {
						body: {
							...(runId ? { runId } : {}),
							messages,
							context: {
								screen: name,
								...(collection ? { collection } : {}),
								...(entryId ? { entryId } : {}),
								...(selectedIds && selectedIds.length > 0 ? { selectedIds } : {}),
							},
						},
					};
				},
			}),
		[site],
	);

	const chat = useChat<AgentMessage>({
		transport,
		sendAutomaticallyWhen: editorToolsAnswered,
		onToolCall: ({ toolCall }) => {
			const { toolName, toolCallId } = toolCall;
			if (!isEditorTool(toolName)) return;
			const { openEditor: editor, format: bodyFormat, noEditor } = latest.current;
			// Not awaited: the answer is added after this callback returns, which lets the run go on.
			if (!editor) return answer.current({ tool: toolName, toolCallId, errorText: noEditor });
			try {
				answer.current({ tool: toolName, toolCallId, output: answerEditorTool(toolName, editor, bodyFormat) });
			} catch (error) {
				answer.current({ tool: toolName, toolCallId, errorText: error instanceof Error ? error.message : noEditor });
			}
		},
	});
	const { messages, setMessages, stop, clearError, addToolOutput } = chat;
	answer.current = ({ tool, toolCallId, output, errorText }) => {
		void (errorText === undefined
			? addToolOutput({ tool, toolCallId, output })
			: addToolOutput({ tool, toolCallId, state: "output-error", errorText }));
	};

	const runId = runIdOf(messages) ?? openedRunId;
	latest.current.runId = runId;

	const reopen = useCallback(
		(id: string, stored: unknown[]) => {
			void stop();
			clearError();
			setOpenedRunId(id);
			setMessages(stored as AgentMessage[]);
		},
		[stop, clearError, setMessages],
	);
	const reset = useCallback(() => {
		void stop();
		clearError();
		setOpenedRunId(undefined);
		setMessages([]);
	}, [stop, clearError, setMessages]);

	return { ...chat, runId, usage: usageOf(messages), reopen, reset };
}
