import { cva } from "class-variance-authority";
import type * as React from "react";
import { cn } from "../lib/utils";

/** What a status means; the color follows from it (`--cms-success`, `--cms-warning`, `--cms-destructive`, muted). */
export type StatusTone = "success" | "warning" | "destructive" | "neutral";

/** The marker's form. The meaning never rests on color alone: pair the shape with a `label`, or give the marker a name some other way. */
export type StatusShape = "dot" | "ring" | "dashed" | "half" | "minus";

const toneClass = cva("shrink-0", {
	variants: {
		tone: {
			success: "text-cms-success",
			warning: "text-cms-warning",
			destructive: "text-cms-destructive",
			neutral: "text-cms-muted-foreground",
		},
		size: {
			/** A bare dot beside a name (language tabs). */
			xs: "size-2",
			/** The dot of the save status. */
			sm: "size-2.5",
			/** The marker of a label in a list column. */
			md: "size-3.5",
		},
	},
	defaultVariants: { tone: "neutral", size: "md" },
});

function Marker({ shape }: { shape: StatusShape }) {
	switch (shape) {
		case "dot":
			return <circle cx="8" cy="8" r="5.5" fill="currentColor" stroke="none" />;
		case "ring":
			return <circle cx="8" cy="8" r="5.5" />;
		case "dashed":
			return <circle cx="8" cy="8" r="5.5" strokeDasharray="2.4 2.4" />;
		case "half":
			return (
				<>
					<circle cx="8" cy="8" r="5.5" />
					<path d="M8 2.5a5.5 5.5 0 0 1 0 11z" fill="currentColor" stroke="none" />
				</>
			);
		case "minus":
			return (
				<>
					<circle cx="8" cy="8" r="5.5" />
					<path d="M5 8h6" />
				</>
			);
	}
}

/**
 * The one status marker of the admin: a small shape in a tone, usually followed by its name. Entry status, delivery state, locale presence,
 * the save status and the language tabs all use it, so a state looks the same wherever it appears.
 */
export function StatusIndicator({
	tone = "neutral",
	shape = "dot",
	size = "md",
	label,
	labelClassName,
	pulse = false,
	className,
	...props
}: Omit<React.ComponentProps<"span">, "children"> & {
	tone?: StatusTone;
	shape?: StatusShape;
	size?: "xs" | "sm" | "md";
	/** The status name next to the marker. Without it the marker is decorative (`aria-hidden`). */
	label?: string;
	/** Classes of the label, e.g. `hidden lg:inline` to keep it for wide screens (it stays readable to screen readers only when it is not `hidden`: set `aria-label` on the parent then). */
	labelClassName?: string;
	/** Breathes while the status is in progress. */
	pulse?: boolean;
}) {
	return (
		<span
			data-slot="status-indicator"
			data-tone={tone}
			className={cn(
				"inline-flex items-center gap-1.5 whitespace-nowrap",
				label && "text-[13px] text-cms-foreground/80",
				className,
			)}
			{...props}
		>
			<svg
				aria-hidden="true"
				focusable="false"
				viewBox="0 0 16 16"
				fill="none"
				stroke="currentColor"
				strokeWidth="1.6"
				className={cn(toneClass({ tone, size }), pulse && "animate-pulse")}
			>
				<Marker shape={shape} />
			</svg>
			{label && <span className={labelClassName}>{label}</span>}
		</span>
	);
}
