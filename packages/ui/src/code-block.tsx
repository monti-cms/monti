import type * as React from "react";
import { cn } from "./cn";

/**
 * Text shown as it is: fixed-width, line breaks kept, on the inset surface (a JSON value, an error's details, a model's answer). Long lines
 * wrap unless `wrap={false}`; it scrolls past `maxHeight`.
 */
function CodeBlock({
	className,
	wrap = true,
	maxHeight = "list",
	size = "caption",
	...props
}: React.ComponentProps<"pre"> & { wrap?: boolean; maxHeight?: "list" | "half" | "none"; size?: "caption" | "label" }) {
	return (
		<pre
			data-slot="code-block"
			className={cn(
				"overflow-auto rounded-md bg-monti-inset p-normal font-mono",
				size === "caption" ? "text-monti-caption" : "text-monti-label",
				wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre",
				maxHeight === "list" && "max-h-96",
				maxHeight === "half" && "max-h-[50vh]",
				className,
			)}
			{...props}
		/>
	);
}

/** What changed between two texts, line by line: removed lines in red with "-", added lines in green with "+", the rest as they are. */
function DiffView({
	lines,
	className,
}: {
	lines: readonly { type: "same" | "add" | "remove"; text: string }[];
	className?: string;
}) {
	return (
		<pre
			data-slot="diff-view"
			className={cn(
				"max-h-96 overflow-auto rounded-md border border-monti-muted font-mono text-monti-caption",
				className,
			)}
		>
			{lines.map((line, index) => (
				<div
					key={index}
					className={cn(
						"flex gap-condensed whitespace-pre-wrap break-words px-condensed",
						line.type === "add" && "bg-monti-success-muted text-monti-success",
						line.type === "remove" && "bg-monti-danger-muted text-monti-danger",
					)}
				>
					<span aria-hidden className="w-2 shrink-0 select-none text-monti-subtle">
						{line.type === "add" ? "+" : line.type === "remove" ? "-" : " "}
					</span>
					<span className="min-w-0">{line.text}</span>
				</div>
			))}
		</pre>
	);
}

/** A run of text marked as removed or added, inside a sentence (a suggested rewrite). */
function DiffMark({ type, children }: { type: "add" | "remove"; children: React.ReactNode }) {
	return type === "add" ? (
		<ins className="rounded-sm bg-monti-success-muted text-monti-success no-underline">{children}</ins>
	) : (
		<del className="rounded-sm bg-monti-danger-muted text-monti-danger">{children}</del>
	);
}

export { CodeBlock, DiffMark, DiffView };
