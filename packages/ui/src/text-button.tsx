"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { cn } from "./cn";
import { useUiLabels } from "./labels";
import { Spinner } from "./spinner";

/**
 * The text of an action inside a section: add, edit, cancel, go to. A `<button>`; with an `href` it is an `<a>`, and the app's router link goes in
 * `render` (`render={<Link href="…" />}`). An icon goes before the text, 14px with a 6px gap; a `Caret` after it keeps its own 12px. It has no box: its text color
 * and, for `underline`, a 1px rule under it say what it is. The design system draws no hover for it; the text turns ink (and the rule too), as an icon button's does.
 * `tone="proposal"` is an action the assistant takes, in the proposal blue: "✦ Fill" on a field's label row (`size="micro"`, the label's own type), "✦ Translate"
 * over a text. While it works (`loading`) a ring leads the words, it cannot be pressed again, it is not dimmed, and it is `aria-busy`. A label row shows the
 * assistant's button only while the pointer or the keyboard is in that field (`FormField` keys on its `data-tone` inside the label row); elsewhere it always shows.
 */
const textButtonVariants = cva(
	"inline cursor-pointer border-0 bg-transparent p-0 text-left whitespace-nowrap no-underline outline-none focus-visible:rounded-monti-sm focus-visible:ring-2 focus-visible:ring-monti-contrast/20 aria-expanded:text-monti-default disabled:cursor-default disabled:opacity-45 aria-disabled:cursor-default aria-disabled:opacity-45 [&_svg:not([data-slot=caret])]:mr-monti-6 [&_svg:not([data-slot=caret])]:inline-block [&_svg:not([data-slot=caret])]:size-3.5 [&_svg]:shrink-0 [&_svg:not([data-slot=caret])]:align-[-0.2em]",
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
			/** Takes the quiet ink on top of its variant: an underlined button that is not the main action of its line (undo, change). */
			quiet: { true: "text-monti-subtle hover:text-monti-default" },
			/** The text size of the line it stands in, when that is not the surrounding text's: the `note` of a list row, the `caption` of a label row. */
			size: {
				note: "text-monti-note",
				caption: "text-monti-caption",
				/** Mono 12, for a value that opens a menu of values (the model, rows per page). */
				meta: "text-monti-meta",
				/** The label's type (mono 11), for the assistant's button on a field's label row. */
				micro:
					"inline-flex items-center gap-monti-4 text-monti-micro [&_svg:not([data-slot=caret])]:mr-0 [&_svg:not([data-slot=caret])]:size-monti-icon-xs",
			},
			/** The assistant's action, in the proposal blue (its rule too). */
			tone: {
				proposal:
					"text-monti-proposal hover:text-monti-proposal border-monti-proposal hover:border-monti-proposal focus-visible:ring-monti-proposal/30",
			},
			/** Working: a ring before the words; it cannot be pressed again and is not dimmed. */
			loading: { true: "cursor-default disabled:opacity-100" },
		},
		defaultVariants: { variant: "plain" },
	},
);

function TextButton({
	className,
	variant,
	mono,
	quiet,
	size,
	tone,
	loading = false,
	disabled,
	render,
	href,
	children,
	...props
}: useRender.ComponentProps<"button"> &
	VariantProps<typeof textButtonVariants> &
	Pick<React.ComponentProps<"a">, "href" | "target" | "rel"> & {
		/** The action is running: a ring before the words (the words say what it does: "Writing…"), and it cannot be pressed again. */
		loading?: boolean;
	}) {
	const labels = useUiLabels();
	const isButton = render === undefined && href === undefined;
	return useRender({
		defaultTagName: href === undefined ? "button" : "a",
		props: mergeProps<"button">(
			{
				className: cn(textButtonVariants({ variant, mono, quiet, size, tone, loading }), className),
				...(isButton ? { type: "button" } : {}),
				...({ "data-tone": tone ?? undefined, "data-loading": loading || undefined } as React.ComponentProps<"button">),
				"aria-busy": loading || undefined,
				disabled: disabled || loading || undefined,
				children: loading ? (
					<>
						<Spinner className="mr-monti-4 size-[0.85em] align-[-0.1em]" />
						{children ?? labels.loading}
					</>
				) : (
					children
				),
			},
			{ ...props, ...(href === undefined ? {} : { href }) } as React.ComponentProps<"button">,
		),
		render,
		state: { slot: "text-button" },
	});
}

export { TextButton };
