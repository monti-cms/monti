"use client";

import { useTranslator } from "@monti-cms/admin";
import { ChatMessage, type ToolCallDetail, ToolCallLine, type ToolCallStatus } from "@monti-cms/admin/kit";
import { getToolName, isToolUIPart } from "ai";
import { agentPanelMessages } from "./agent-panel.messages";
import type { AgentMessage } from "./use-agent-chat";

type ToolPart = Extract<AgentMessage["parts"][number], { toolCallId: string }>;

/** An operation that failed answers with `{ error: { code, message } }` instead of its result: the run goes on, but the call did not work. */
const isFailureResult = (output: unknown): boolean =>
	typeof output === "object" &&
	output !== null &&
	"error" in output &&
	typeof (output as { error?: { code?: unknown } }).error?.code === "string";

const statusOf = (part: ToolPart): ToolCallStatus =>
	part.state === "output-error" || part.state === "output-denied"
		? "failed"
		: part.state === "output-available"
			? isFailureResult(part.output)
				? "failed"
				: "done"
			: "running";

/** The operation as the admin knows it: the model's tool name (`entries_list`) with the dot of the operation (`entries.list`) put back. */
export const operationOf = (toolName: string): string => toolName.replaceAll("_", ".");

const json = (value: unknown) => JSON.stringify(value, null, 2);

/** One tool call as a compact line: the operation and whether it is running, done or failed. It opens to show the input and the result. */
function ToolLine({ part }: { part: ToolPart }) {
	const t = useTranslator(agentPanelMessages);
	const status = statusOf(part);
	const result =
		part.state === "output-error" ? part.errorText : part.state === "output-available" ? part.output : undefined;
	const details: ToolCallDetail[] = [
		...(part.input !== undefined ? [{ label: t("tool.input"), value: json(part.input) }] : []),
		...(result !== undefined
			? [{ label: t("tool.result"), value: typeof result === "string" ? result : json(result) }]
			: []),
	];
	return (
		<ToolCallLine status={status} statusLabel={t(`tool.${status}`)} details={details}>
			{operationOf(getToolName(part))}
		</ToolCallLine>
	);
}

/** One message of the conversation: what the admin asked, or the assistant's text and tool lines in the order they came. `streaming` marks the answer still being written. */
export function MessageView({ message, streaming = false }: { message: AgentMessage; streaming?: boolean }) {
	const lastText = message.parts.findLastIndex((part) => part.type === "text" && part.text);
	const parts = message.parts.flatMap((part, index) => {
		if (part.type === "text")
			return part.text
				? [
						<ChatMessage
							key={`${message.id}:${index}`}
							author={message.role === "user" ? "user" : "assistant"}
							streaming={streaming && index === lastText}
						>
							{part.text}
						</ChatMessage>,
					]
				: [];
		if (isToolUIPart(part)) return [<ToolLine key={part.toolCallId} part={part as ToolPart} />];
		return [];
	});
	return parts.length > 0 ? parts : null;
}
