"use client";

import { Check, TriangleAlert } from "lucide-react";
import { type ComponentProps, type ReactNode, useState } from "react";
import { Caret } from "./caret";
import { cn } from "./cn";
import { CodeBlock } from "./code-block";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";
import { Text } from "./text";

export type ToolCallStatus = "running" | "done" | "failed";

/** One block of the opened line: a caption (`Input`) and the text under it, shown as it is. */
export interface ToolCallDetail {
	readonly label: ReactNode;
	readonly value: string;
}

const LINE =
	"flex items-center gap-monti-8 py-[3px] text-left font-mono text-monti-meta text-monti-subtle [&_svg]:shrink-0";

/**
 * One call the assistant made, as a mono line: a mark for where it stands (running, ✓ done, ⚠ failed) and what was done, in words ("Read the post list ·
 * 6 posts"). With `details` the line opens to show the input and the result; without, it is a plain line. `statusLabel` is the status in words for screen
 * readers; it is not drawn.
 */
function ToolCallLine({
	status,
	statusLabel,
	details,
	defaultOpen = false,
	className,
	children,
	...props
}: Omit<ComponentProps<"div">, "children"> & {
	status: ToolCallStatus;
	statusLabel: string;
	details?: readonly ToolCallDetail[];
	defaultOpen?: boolean;
	/** What was done. */
	children: ReactNode;
}) {
	const [open, setOpen] = useState(defaultOpen);
	const expandable = details !== undefined && details.length > 0;
	const summary = (
		<>
			{status === "running" ? (
				<span aria-hidden className="w-3.5 shrink-0 text-center">
					…
				</span>
			) : status === "done" ? (
				<Check aria-hidden className="size-3.5" strokeWidth={1.6} />
			) : (
				<TriangleAlert aria-hidden className="size-3.5 text-monti-danger" strokeWidth={1.6} />
			)}
			<span className={cn(status === "failed" && "text-monti-danger")}>{children}</span>
			<span className="sr-only">{statusLabel}</span>
			{/* A line that opens ends in a caret; a plain line has none. It turns over while open. */}
			{expandable && <Caret className="ml-0 transition-transform group-data-panel-open/line:rotate-180" />}
		</>
	);
	return (
		<div data-slot="tool-call-line" data-status={status} className={cn("min-w-0", className)} {...props}>
			{expandable ? (
				<Collapsible open={open} onOpenChange={setOpen}>
					<CollapsibleTrigger
						className={cn(
							LINE,
							"group/line cursor-pointer border-0 bg-transparent p-0 py-[3px] outline-none hover:text-monti-default focus-visible:rounded-monti-sm focus-visible:ring-2 focus-visible:ring-monti-contrast/20",
						)}
					>
						{summary}
					</CollapsibleTrigger>
					<CollapsibleContent>
						<div className="flex flex-col gap-monti-4 py-monti-4">
							{details.map((detail) => (
								<div key={String(detail.label)} className="flex flex-col gap-monti-4">
									<Text variant="micro" tone="subtle">
										{detail.label}
									</Text>
									<CodeBlock maxHeight="list">{detail.value}</CodeBlock>
								</div>
							))}
						</div>
					</CollapsibleContent>
				</Collapsible>
			) : (
				<div className={LINE}>{summary}</div>
			)}
		</div>
	);
}

export { ToolCallLine };
