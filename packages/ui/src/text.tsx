import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "./cn";

/**
 * Text in one of the design system's roles. `variant` is the role: size, line height and weight together (styles/theme.css); `tone` sets the color by meaning.
 * `weight` only emphasizes a run inside its role. Controls (buttons, inputs, menus) already carry their role and take plain text.
 */
export const textVariants = cva("", {
	variants: {
		variant: {
			micro: "text-monti-micro",
			caption: "text-monti-caption",
			label: "text-monti-label",
			body: "text-monti-body",
			reading: "text-monti-reading",
			title: "text-monti-title",
			heading: "text-monti-heading",
			display: "text-monti-display",
		},
		tone: {
			default: "text-monti-default",
			muted: "text-monti-muted",
			subtle: "text-monti-subtle",
			accent: "text-monti-accent",
			danger: "text-monti-danger",
			warning: "text-monti-warning",
			success: "text-monti-success",
			inherit: "",
			/** The field list's kind colors (component tokens of the collection settings). */
			"kind-teal": "text-monti-kind-teal",
			"kind-blue": "text-monti-kind-blue",
			"kind-violet": "text-monti-kind-violet",
			"kind-orange": "text-monti-kind-orange",
			"kind-green": "text-monti-kind-green",
		},
		weight: { role: "", medium: "font-medium", semibold: "font-semibold" },
		mono: { true: "font-mono" },
		truncate: { true: "truncate" },
		/** Read by screen readers, not shown (a column name over buttons, a label the layout already makes plain). */
		srOnly: { true: "sr-only" },
		/** At most this many lines, then "…". */
		lines: { 2: "line-clamp-2", 3: "line-clamp-3" },
		italic: { true: "italic" },
		/** Keeps the text's own line breaks (an error message, a model's answer). */
		preserveLines: { true: "whitespace-pre-wrap" },
		align: { start: "text-left", center: "text-center", end: "text-right" },
	},
	defaultVariants: { variant: "body", tone: "inherit", weight: "role" },
});

type TextProps = React.HTMLAttributes<HTMLElement> &
	VariantProps<typeof textVariants> & {
		as?: "span" | "p" | "div" | "label" | "dt" | "dd" | "li" | "code" | "time";
		htmlFor?: string;
	};

function Text({
	as: Tag = "span",
	variant,
	tone,
	weight,
	mono,
	truncate,
	srOnly,
	lines,
	italic,
	preserveLines,
	align,
	className,
	...props
}: TextProps) {
	return (
		<Tag
			className={cn(
				textVariants({ variant, tone, weight, mono, truncate, srOnly, lines, italic, preserveLines, align }),
				className,
			)}
			{...props}
		/>
	);
}

/** A heading in a heading role (`variant`): `title` for sections, panels and dialogs (the default), `heading` for the screen, `display` for the post title. */
function Heading({
	as: Tag = "h2",
	variant = "title",
	tone,
	truncate,
	className,
	...props
}: React.HTMLAttributes<HTMLHeadingElement> & {
	as?: "h1" | "h2" | "h3" | "h4";
	/** `label` for a small heading inside a panel or sheet; `title` for sections, panels and dialogs; `heading` the screen; `display` the post title. */
	variant?: "label" | "title" | "heading" | "display";
	tone?: VariantProps<typeof textVariants>["tone"];
	truncate?: boolean;
}) {
	return <Tag className={cn(textVariants({ variant, tone, truncate }), className)} {...props} />;
}

export { Heading, Text };
