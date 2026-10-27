import type * as React from "react";
import { cn } from "./cn";
import { Count } from "./count";

/**
 * A one-line notice across the top of a pane, under its header, for something the writer should know about the whole page ("The Korean source
 * changed"): cream background and one rule below. `title` is the sentence in the warning color, `meta` the small detail after it in mono; `children`
 * are what can be done about it, at the right end (text buttons: the one that goes there underlined, then the one that dismisses).
 */
function Banner({
	title,
	meta,
	className,
	children,
	...props
}: Omit<React.ComponentProps<"div">, "title"> & {
	title: React.ReactNode;
	meta?: React.ReactNode;
}) {
	return (
		<div
			data-slot="banner"
			role="status"
			className={cn(
				"flex items-center gap-monti-16 border-monti-default border-b bg-monti-tool px-monti-24 py-[10px] text-monti-note",
				className,
			)}
			{...props}
		>
			<span className="font-semibold text-monti-warning">{title}</span>
			{meta && <Count>{meta}</Count>}
			{children && <span className="ml-auto flex items-center gap-monti-16">{children}</span>}
		</div>
	);
}

export { Banner };
