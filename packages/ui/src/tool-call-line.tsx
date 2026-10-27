"use client";

import { Check, ChevronDown, ChevronRight, TriangleAlert } from "lucide-react";
import { type ComponentProps, type ReactNode, useState } from "react";
import { cn } from "./cn";
import { CodeBlock } from "./code-block";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";
import { Spinner } from "./spinner";
import { Text } from "./text";
import { TextButton } from "./text-button";

export type ToolCallStatus = "running" | "done" | "failed";

/** One block of the opened line: a caption (`Input`) and the text under it, shown as it is. */
export interface ToolCallDetail {
	readonly label: ReactNode;
	readonly value: string;
}

/**
 * One call the assistant made, as a compact line: the operation's name, a mark and a word for where it stands (`running`, `done`, `failed`). With `details` the
 * line opens to show them (the input and the result); without, it is a plain line. The words are the app's (`statusLabel`).
 */
export function ToolCallLine({
	name,
	status,
	statusLabel,
	details,
	defaultOpen = false,
	className,
	...props
}: Omit<ComponentProps<"div">, "children"> & {
	name: string;
	status: ToolCallStatus;
	statusLabel: string;
	details?: readonly ToolCallDetail[];
	defaultOpen?: boolean;
}) {
	const [open, setOpen] = useState(defaultOpen);
	const expandable = details !== undefined && details.length > 0;
	const summary = (
		<>
			{expandable && (open ? <ChevronDown aria-hidden /> : <ChevronRight aria-hidden />)}
			<Text variant="caption" mono>
				{name}
			</Text>
			{status === "running" ? (
				<Spinner size="sm" />
			) : status === "done" ? (
				<Check aria-hidden />
			) : (
				<TriangleAlert aria-hidden />
			)}
			<Text variant="caption" tone={status === "failed" ? "danger" : "muted"}>
				{statusLabel}
			</Text>
		</>
	);
	return (
		<div data-slot="tool-call-line" data-status={status} className={cn("min-w-0", className)} {...props}>
			{expandable ? (
				<Collapsible open={open} onOpenChange={setOpen}>
					<CollapsibleTrigger render={<TextButton variant="quiet" className="inline-flex items-center gap-monti-6" />}>
						{summary}
					</CollapsibleTrigger>
					<CollapsibleContent>
						<div className="flex flex-col gap-monti-4 py-monti-4">
							{details.map((detail) => (
								<div key={String(detail.label)} className="flex flex-col gap-monti-4">
									<Text variant="caption" tone="muted">
										{detail.label}
									</Text>
									<CodeBlock maxHeight="list">{detail.value}</CodeBlock>
								</div>
							))}
						</div>
					</CollapsibleContent>
				</Collapsible>
			) : (
				<div className="inline-flex h-monti-control-sm items-center gap-monti-8 px-monti-8 [&_svg]:size-4">
					{summary}
				</div>
			)}
		</div>
	);
}
