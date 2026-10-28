"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "./cn";

/**
 * The text of an action inside a section: add, edit, cancel, go to. A `<button>`; with an `href` it is an `<a>`, and the app's router link goes in
 * `render` (`render={<Link href="…" />}`). An icon goes before the text, 14px with a 6px gap; a `Caret` after it keeps its own 12px. It has no box: its text color
 * and, for `underline`, a 1px rule under it say what it is. The design system draws no hover for it; the text turns ink (and the rule too), as an icon button's does.
 */
const textButtonVariants = cva(
	"inline cursor-pointer border-0 bg-transparent p-0 text-left whitespace-nowrap no-underline outline-none focus-visible:rounded-monti-sm focus-visible:ring-2 focus-visible:ring-monti-contrast/20 disabled:cursor-default disabled:opacity-45 aria-disabled:cursor-default aria-disabled:opacity-45 [&_svg:not([data-slot=caret])]:mr-monti-6 [&_svg:not([data-slot=caret])]:inline-block [&_svg:not([data-slot=caret])]:size-3.5 [&_svg]:shrink-0 [&_svg:not([data-slot=caret])]:align-[-0.2em]",
	{
		variants: {
			variant: {
				/** Cancel, undo all. */
				plain: "text-monti-muted hover:text-monti-default",
				/** Takes you somewhere or opens something: review, fill with AI, see in the list →. */
				underline: "border-b border-monti-strong text-monti-muted hover:border-monti-contrast hover:text-monti-default",
				/** Less important: + language, + group. */
				quiet: "text-monti-subtle hover:text-monti-default",
				/** The risky second choice of a confirmation. */
				danger: "text-monti-danger",
				/** The one thing a row asks for before anything else (restore the original first): in ink, among quieter buttons. */
				ink: "text-monti-default",
				/** Takes the ink and size of the line it stands in (the button at the end of a `ChangeLine`). */
				inherit: "text-[length:inherit] text-inherit",
			},
			/** Fixed-width letters, for an address or an identifier. */
			mono: { true: "font-mono" },
		},
		defaultVariants: { variant: "plain" },
	},
);

function TextButton({
	className,
	variant,
	mono,
	render,
	href,
	...props
}: useRender.ComponentProps<"button"> &
	VariantProps<typeof textButtonVariants> &
	Pick<React.ComponentProps<"a">, "href" | "target" | "rel">) {
	const isButton = render === undefined && href === undefined;
	return useRender({
		defaultTagName: href === undefined ? "button" : "a",
		props: mergeProps<"button">(
			{ className: cn(textButtonVariants({ variant, mono }), className), ...(isButton ? { type: "button" } : {}) },
			{ ...props, ...(href === undefined ? {} : { href }) } as React.ComponentProps<"button">,
		),
		render,
		state: { slot: "text-button" },
	});
}

export { TextButton };
