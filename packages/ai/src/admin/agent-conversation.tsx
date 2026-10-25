"use client";

import { useTranslator } from "@monti-cms/admin";
import {
	Box,
	Button,
	CodeBlock,
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
	Inline,
	Spinner,
	Stack,
	Text,
} from "@monti-cms/admin/kit";
import { getToolName, isToolUIPart } from "ai";
import { Check, ChevronDown, ChevronRight, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { agentPanelMessages } from "./agent-panel.messages";
import type { AgentMessage } from "./use-agent-chat";

type ToolPart = Extract<AgentMessage["parts"][number], { toolCallId: string }>;
type ToolStatus = "running" | "done" | "failed";

/** An operation that failed answers with `{ error: { code, message } }` instead of its result: the run goes on, but the call did not work. */
const isFailureResult = (output: unknown): boolean =>
	typeof output === "object" &&
	output !== null &&
	"error" in output &&
	typeof (output as { error?: { code?: unknown } }).error?.code === "string";

const statusOf = (part: ToolPart): ToolStatus =>
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
export function ToolLine({ part }: { part: ToolPart }) {
	const t = useTranslator(agentPanelMessages);
	const [open, setOpen] = useState(false);
	const status = statusOf(part);
	const result =
		part.state === "output-error" ? part.errorText : part.state === "output-available" ? part.output : undefined;
	return (
		<Collapsible open={open} onOpenChange={setOpen}>
			<CollapsibleTrigger render={<Button type="button" variant="quiet" size="sm" />} data-status={status}>
				<Inline gap="condensed">
					{open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />}
					<Text variant="caption" mono>
						{operationOf(getToolName(part))}
					</Text>
					{status === "running" ? (
						<Spinner size="sm" />
					) : status === "done" ? (
						<Check aria-hidden />
					) : (
						<TriangleAlert aria-hidden />
					)}
					<Text variant="caption" tone={status === "failed" ? "danger" : "muted"}>
						{t(`tool.${status}`)}
					</Text>
				</Inline>
			</CollapsibleTrigger>
			<CollapsibleContent>
				<Stack gap="tight" paddingY="tight">
					{part.input !== undefined && (
						<>
							<Text variant="caption" tone="muted">
								{t("tool.input")}
							</Text>
							<CodeBlock maxHeight="list">{json(part.input)}</CodeBlock>
						</>
					)}
					{result !== undefined && (
						<>
							<Text variant="caption" tone="muted">
								{t("tool.result")}
							</Text>
							<CodeBlock maxHeight="list">{typeof result === "string" ? result : json(result)}</CodeBlock>
						</>
					)}
				</Stack>
			</CollapsibleContent>
		</Collapsible>
	);
}

/** One message of the conversation: what the admin asked, or the assistant's text and tool lines in the order they came. */
export function MessageView({ message }: { message: AgentMessage }) {
	const parts = message.parts.flatMap((part, index) => {
		if (part.type === "text")
			return part.text
				? [<TextPart key={`${message.id}:${index}`} text={part.text} user={message.role === "user"} />]
				: [];
		if (isToolUIPart(part)) return [<ToolLine key={part.toolCallId} part={part as ToolPart} />];
		return [];
	});
	return parts.length > 0 ? (
		<Stack gap="tight" data-role={message.role}>
			{parts}
		</Stack>
	) : null;
}

function TextPart({ text, user }: { text: string; user: boolean }) {
	return user ? (
		<Box background="neutral" radius="lg" padding="condensed">
			<Text as="p" preserveLines>
				{text}
			</Text>
		</Box>
	) : (
		<Text as="p" preserveLines>
			{text}
		</Text>
	);
}
