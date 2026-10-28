import type * as React from "react";
import { cn } from "./cn";
import { Count } from "./count";

/**
 * A one-line notice across the top of a pane, under its header, for something the writer should know about the whole page ("The Korean source
 * changed"): cream background and one rule below. A 6px dot leads the sentence, 8px before its words. `tone="warning"` (the default) sets the sentence in the warning text color and the dot in the
 * warning mark color; `tone="danger"` is for something that failed (a delivery, a save) and makes both red. `title` is the sentence, `meta` the small detail after it in mono, which is cut with "…" when the line is short (the sentence and the actions never wrap); `children`
 * are what can be done about it, at the right end (text buttons: the one that goes there underlined, then the one that dismisses).
 */
function Banner({
	title,
	meta,
	tone = "warning",
	className,
	children,
	...props
}: Omit<React.ComponentProps<"div">, "title"> & {
	title: React.ReactNode;
	meta?: React.ReactNode;
	/** `warning` for something to know, `danger` for something that failed. */
	tone?: "warning" | "danger";
}) {
	return (
		<div
			data-slot="banner"
			data-tone={tone}
			role="status"
			className={cn(
				"flex items-center gap-monti-16 border-monti-default border-b bg-monti-tool px-monti-24 py-[10px] text-monti-note",
				className,
			)}
			{...props}
		>
			<span
				className={cn(
					"inline-flex shrink-0 items-center gap-monti-8 whitespace-nowrap font-semibold",
					tone === "danger" ? "text-monti-danger" : "text-monti-warning",
				)}
			>
				<span
					aria-hidden="true"
					data-slot="banner-dot"
					className={cn(
						"size-1.5 shrink-0 rounded-monti-full",
						tone === "danger" ? "bg-(--monti-fg-danger)" : "bg-monti-warning-emphasis",
					)}
				/>
				{title}
			</span>
			{meta && <Count className="min-w-0 truncate">{meta}</Count>}
			{children && (
				<span className="ml-auto flex shrink-0 items-center gap-monti-16 whitespace-nowrap">{children}</span>
			)}
		</div>
	);
}

export { Banner };
