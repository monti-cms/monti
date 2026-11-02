"use client";

import { useSite, useTranslator } from "@monti-cms/admin";
import {
	ChatAnswer,
	ChatMessage,
	type ToolCallDetail,
	ToolCallLine,
	ToolCallLines,
	type ToolCallStatus,
} from "@monti-cms/admin/kit";
import { getToolName, isToolUIPart } from "ai";
import type { ReactNode } from "react";
import { agentPanelMessages } from "./agent-panel.messages";
import { type ToolLineState, toolLineText } from "./tool-labels";
import type { AgentMessage } from "./use-agent-chat";

type ToolPart = Extract<AgentMessage["parts"][number], { toolCallId: string }>;

/** An operation that failed answers with `{ error: { code, message } }` instead of its result: the run goes on, but the call did not work. */
const isFailureResult = (output: unknown): boolean =>
	typeof output === "object" &&
	output !== null &&
	"error" in output &&
	typeof (output as { error?: { code?: unknown } }).error?.code === "string";

/** Where a call stands. A call with no result once the answer has ended was cut off or stopped there. */
const stateOf = (part: ToolPart, live: boolean): ToolLineState =>
	part.state === "output-error" || part.state === "output-denied"
		? "failed"
		: part.state === "output-available"
			? isFailureResult(part.output)
				? "failed"
				: "done"
			: live
				? "running"
				: "stopped";

const LINE_STATUS: Record<ToolLineState, ToolCallStatus> = {
	running: "running",
	done: "done",
	failed: "failed",
	stopped: "failed",
};

/** The operation as the admin knows it: the model's tool name (`entries_list`) with the dot of the operation (`entries.list`) put back. */
export const operationOf = (toolName: string): string => toolName.replaceAll("_", ".");

const json = (value: unknown) => JSON.stringify(value, null, 2);

/** One tool call as a mono line that says what it did ("Read the entry list · posts 148"). It opens to show the input and the result. */
function ToolLine({ part, live }: { part: ToolPart; live: boolean }) {
	const site = useSite();
	const t = useTranslator(agentPanelMessages);
	const state = stateOf(part, live);
	const status = LINE_STATUS[state];
	const output = part.state === "output-available" ? part.output : undefined;
	const result = part.state === "output-error" ? part.errorText : output;
	const details: ToolCallDetail[] = [
		...(part.input !== undefined ? [{ label: t("tool.input"), value: json(part.input) }] : []),
		...(result !== undefined
			? [{ label: t("tool.result"), value: typeof result === "string" ? result : json(result) }]
			: []),
	];
	return (
		<ToolCallLine status={status} statusLabel={t(`tool.${state}`)} details={details}>
			{toolLineText(site, operationOf(getToolName(part)), state, part.input, output)}
		</ToolCallLine>
	);
}

/** What a message of the admin was about, from its metadata: the rows they had picked ("2 picked"). */
function useContextLabel(message: AgentMessage): string | undefined {
	const t = useTranslator(agentPanelMessages);
	const picked = message.metadata?.picked;
	if (!picked) return undefined;
	return picked.screen === "media"
		? t("picked.media", { count: picked.count })
		: t("picked.entries", { count: picked.count });
}

/**
 * One message of the conversation: what the admin asked (with what it was about, or the spark of a default request), or the assistant's answer: its tool
 * lines grouped as they came, its words, and what follows (`children`, a notice of the answer). `live` marks the answer still arriving.
 */
export function MessageView({
	message,
	live = false,
	children,
}: {
	message: AgentMessage;
	live?: boolean;
	children?: ReactNode;
}) {
	const context = useContextLabel(message);
	if (message.role === "user") {
		const text = message.parts.flatMap((part) => (part.type === "text" && part.text ? [part.text] : [])).join("\n");
		return (
			<ChatMessage
				author="user"
				{...(context ? { context } : {})}
				{...(message.metadata?.request ? { request: true } : {})}
			>
				{text}
			</ChatMessage>
		);
	}
	const lastText = message.parts.findLastIndex((part) => part.type === "text" && part.text);
	// Tool calls that came one after another share one block of lines; words between them split it.
	const blocks: ReactNode[] = [];
	let lines: ReactNode[] = [];
	const flush = (key: string) => {
		if (lines.length > 0) blocks.push(<ToolCallLines key={key}>{lines}</ToolCallLines>);
		lines = [];
	};
	message.parts.forEach((part, index) => {
		if (isToolUIPart(part)) {
			lines.push(<ToolLine key={part.toolCallId} part={part as ToolPart} live={live} />);
			return;
		}
		if (part.type === "text" && part.text) {
			flush(`${message.id}:lines:${index}`);
			blocks.push(
				<ChatMessage key={`${message.id}:${index}`} streaming={live && index === lastText}>
					{part.text}
				</ChatMessage>,
			);
		}
	});
	flush(`${message.id}:lines:end`);
	if (blocks.length === 0 && !children) return null;
	return (
		<ChatAnswer>
			{blocks}
			{children}
		</ChatAnswer>
	);
}
