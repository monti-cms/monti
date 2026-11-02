"use client";

import { Checkmark, Close } from "@carbon/icons-react";
import { type ComponentProps, type ReactNode, useState } from "react";
import { Caret } from "./caret";
import { cn } from "./cn";
import { CodeBlock } from "./code-block";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "./collapsible";
import { Spinner } from "./spinner";
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
 * One call the assistant made, as a mono line: a mark for where it stands (a spinner and darker words while running, ✓ done, a red × and red words when
 * it failed or stopped there) and what was done, in words ("Read the post list · 6 posts"). With `details` the line opens to show the input and the result (its caret shows only while it is pointed at, focused or open); without, it is a plain line. `statusLabel` is the status in words for screen
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
	const tone = status === "running" ? "text-monti-muted" : status === "failed" ? "text-monti-danger" : undefined;
	const summary = (
		<>
			{status === "running" ? (
				<Spinner />
			) : status === "done" ? (
				<Checkmark aria-hidden className="size-3.5" />
			) : (
				<Close aria-hidden className="size-3.5" />
			)}
			<span>{children}</span>
			<span className="sr-only">{statusLabel}</span>
			{/* A line that opens shows a caret while pointed at, focused or open; a plain line has none. It turns over while open. */}
			{expandable && (
				<Caret className="ml-0 opacity-0 transition-transform group-hover/line:opacity-100 group-focus-visible/line:opacity-100 group-data-panel-open/line:rotate-180 group-data-panel-open/line:opacity-100" />
			)}
		</>
	);
	return (
		<div data-slot="tool-call-line" data-status={status} className={cn("min-w-0", className)} {...props}>
			{expandable ? (
				<Collapsible open={open} onOpenChange={setOpen}>
					<CollapsibleTrigger
						className={cn(
							LINE,
							tone,
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
				<div className={cn(LINE, tone)}>{summary}</div>
			)}
		</div>
	);
}

export { ToolCallLine };
