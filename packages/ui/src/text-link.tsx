"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "./cn";

/**
 * Text that takes you somewhere or does one small thing: an entry title in a table, "Details". An `<a>` by default; pass the app's router link
 * as `render` (`render={<Link href="…" />}`), or `render={<button type="button" />}` for an action that reads as text.
 */
const textLinkVariants = cva(
	"cursor-pointer rounded-monti-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-monti-contrast/20",
	{
		variants: {
			/** `none`: a whole row or card that is clickable, where the surface shows the hover instead. */
			underline: {
				always: "underline underline-offset-2",
				hover: "underline-offset-2 hover:underline",
				none: "no-underline",
			},
			tone: { default: "", muted: "text-monti-muted hover:text-monti-default", accent: "text-monti-default" },
			mono: { true: "font-mono" },
			size: { inherit: "", caption: "text-monti-caption", label: "text-monti-label", body: "text-monti-body" },
		},
		defaultVariants: { underline: "always", tone: "default", size: "inherit" },
	},
);

function TextLink({
	className,
	underline,
	tone,
	mono,
	size,
	render,
	...props
}: useRender.ComponentProps<"a"> & VariantProps<typeof textLinkVariants>) {
	return useRender({
		defaultTagName: "a",
		props: mergeProps<"a">({ className: cn(textLinkVariants({ underline, tone, mono, size }), className) }, props),
		render,
		state: { slot: "text-link" },
	});
}

export { TextLink };
