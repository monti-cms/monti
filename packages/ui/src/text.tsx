"use client";

import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { createContext, useContext } from "react";

import { cn } from "./cn";

/**
 * Text in one of the design system's roles. `variant` is the role: size, line height and weight together (styles/theme.css); `tone` sets the color by meaning.
 * `weight` only emphasizes a run inside its role. Controls (buttons, inputs, menus) already carry their role and take plain text.
 */
export const textVariants = cva("", {
	variants: {
		variant: {
			micro: "text-monti-micro",
			meta: "text-monti-meta",
			caption: "text-monti-caption",
			note: "text-monti-note",
			label: "text-monti-label",
			body: "text-monti-body",
			title: "text-monti-title",
			reading: "text-monti-reading",
			heading: "text-monti-heading",
			page: "text-monti-page",
			display: "text-monti-display",
		},
		tone: {
			default: "text-monti-default",
			muted: "text-monti-muted",
			subtle: "text-monti-subtle",
			danger: "text-monti-danger",
			warning: "text-monti-warning",
			success: "text-monti-success",
			inherit: "",
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

/**
 * Set inside any text that has a role (a `Text` or a `Heading`). A `Text` inside one with no `variant` of its own takes the outer role instead of
 * `body`, so a heading's run keeps the heading size and a caption's bold word stays caption-sized.
 */
const InsideRole = createContext(false);

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
	const inside = useContext(InsideRole);
	const role = variant === undefined && inside ? null : variant;
	return (
		<InsideRole.Provider value={true}>
			<Tag
				className={cn(
					textVariants({ variant: role, tone, weight, mono, truncate, srOnly, lines, italic, preserveLines, align }),
					className,
				)}
				{...props}
			/>
		</InsideRole.Provider>
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
	return (
		<InsideRole.Provider value={true}>
			<Tag className={cn(textVariants({ variant, tone, truncate }), className)} {...props} />
		</InsideRole.Provider>
	);
}

export { Heading, Text };
