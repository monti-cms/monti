import { cva } from "class-variance-authority";
import type * as React from "react";
import { cn } from "./cn";

/** What a status means; the color follows from it (success, warning, danger, muted). */
export type StatusTone = "success" | "warning" | "danger" | "neutral" | "strong";

/** The marker's form. The meaning never rests on color alone: pair the shape with a `label`, or give the marker a name some other way. */
export type StatusShape = "dot" | "ring" | "dashed" | "half" | "minus";

const toneClass = cva("shrink-0", {
	variants: {
		tone: {
			success: "text-monti-success",
			warning: "text-monti-warning",
			danger: "text-monti-danger",
			neutral: "text-monti-muted",
			/** The page text color: the monochrome "published" and "draft" markers. */
			strong: "text-monti-default",
		},
		size: {
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
	hideLabelBelow,
	chip = false,
	pulse = false,
	className,
	...props
}: Omit<React.ComponentProps<"span">, "children"> & {
	tone?: StatusTone;
	shape?: StatusShape;
	size?: "sm" | "md";
	/** The status name next to the marker. Without it the marker is decorative (`aria-hidden`). */
	label?: string;
	/** Shows the label only from this width up (the marker stays); set `aria-label` on the parent so screen readers still get the name. */
	hideLabelBelow?: "sm" | "md" | "lg";
	/** A pill with a hairline border around marker and label (the entry status beside the address in the editor). */
	chip?: boolean;
	/** Breathes while the status is in progress. */
	pulse?: boolean;
}) {
	return (
		<span
			data-slot="status-indicator"
			data-tone={tone}
			className={cn(
				"inline-flex items-center gap-1.5 whitespace-nowrap",
				label && "text-monti-default text-monti-label",
				chip && "rounded-monti-full border border-monti-muted px-monti-8 py-monti-2",
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
			{label && (
				<span
					className={cn(
						hideLabelBelow === "sm" && "max-sm:hidden",
						hideLabelBelow === "md" && "max-md:hidden",
						hideLabelBelow === "lg" && "max-lg:hidden",
					)}
				>
					{label}
				</span>
			)}
		</span>
	);
}
