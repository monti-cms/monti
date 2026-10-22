import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "../lib/utils/cn";

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
		},
		weight: { role: "", medium: "font-medium", semibold: "font-semibold" },
		mono: { true: "font-mono" },
		truncate: { true: "truncate" },
	},
	defaultVariants: { variant: "body", tone: "inherit", weight: "role" },
});

type TextProps = React.HTMLAttributes<HTMLElement> &
	VariantProps<typeof textVariants> & {
		as?: "span" | "p" | "div" | "label" | "dt" | "dd" | "li" | "code" | "time";
		htmlFor?: string;
	};

function Text({ as: Tag = "span", variant, tone, weight, mono, truncate, className, ...props }: TextProps) {
	return <Tag className={cn(textVariants({ variant, tone, weight, mono, truncate }), className)} {...props} />;
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
	variant?: "title" | "heading" | "display";
	tone?: VariantProps<typeof textVariants>["tone"];
	truncate?: boolean;
}) {
	return <Tag className={cn(textVariants({ variant, tone, truncate }), className)} {...props} />;
}

export { Heading, Text };
