"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";
import { useEffect, useRef, useState } from "react";
import { BUSY_GUARD } from "./busy";
import { cn } from "./cn";
import { Spinner } from "./spinner";

/**
 * A pill. One `primary` per screen or floating surface, then `secondary` for the one or two common side actions, `danger` only to confirm
 * something that cannot be undone, and `outline-danger` for a quieter version of it. The text is centered by the font (no padding nudge), and a
 * leading icon pulls 2px into the left padding so it centers visually. The filled pills have no border, so their text starts at the padding the
 * design system gives (18px, 16px for `secondary`, 12px for `sm`); only `outline-danger` draws a 1px line.
 * A button that is `loading` keeps its fill and its place: a spinner comes first, in place of the button's own leading icon, set by eye: 13px from the left edge at `md`
 * (2px more than from the top and bottom) and 10px at `sm`, with 7px to the words and a tighter right side (15px, 13px for `secondary`, 9px at `sm`). The caller changes the label to say what is happening ("Saving…", "Uploading 64%"); it cannot be pressed again, its cursor says so, and it is `aria-busy`. It keeps the keyboard's focus while it works.
 */
const buttonVariants = cva(
	"group/button inline-flex shrink-0 items-center justify-center gap-monti-6 rounded-monti-full whitespace-nowrap outline-none transition-colors select-none focus-visible:ring-2 focus-visible:ring-monti-contrast/50 cursor-pointer disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 data-loading:pointer-events-auto data-loading:cursor-not-allowed data-loading:opacity-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&>svg:first-child]:-ml-[2px] data-loading:gap-[7px] data-loading:[&>[data-slot=spinner]+svg]:hidden",
	{
		variants: {
			variant: {
				/** The one main action of a screen or a floating surface. */
				primary:
					"bg-monti-emphasis px-[18px] font-semibold text-monti-on-emphasis not-data-loading:not-disabled:hover:bg-monti-emphasis/90 not-data-loading:not-disabled:active:bg-monti-emphasis/80",
				/** A common side action. */
				secondary:
					"bg-monti-muted px-monti-16 font-normal text-monti-muted not-data-loading:not-disabled:hover:bg-monti-selected not-data-loading:not-disabled:active:bg-monti-current not-data-loading:not-disabled:active:text-monti-default",
				/** Confirms something that cannot be undone. Only inside a confirmation. */
				danger:
					"bg-monti-danger-emphasis px-[18px] font-semibold text-monti-on-emphasis not-data-loading:not-disabled:hover:bg-monti-danger-emphasis/90 not-data-loading:not-disabled:active:bg-monti-danger-emphasis/80",
				/**
				 * An action that stands on its own where a pill would be too heavy (undo all beside the save pill, a toolbar's upload, "+ add" under a
				 * list): no ground at rest, the muted ground under the pointer and the selected one while pressed (and while it is on, `aria-pressed`, or
				 * its menu is open), at the same heights as the pills.
				 */
				ghost:
					"bg-transparent px-monti-12 font-normal text-monti-muted not-data-loading:not-disabled:hover:bg-monti-muted not-data-loading:not-disabled:hover:text-monti-default not-data-loading:not-disabled:active:bg-monti-selected not-data-loading:not-disabled:active:text-monti-default aria-pressed:bg-monti-selected aria-pressed:text-monti-default aria-expanded:bg-monti-selected aria-expanded:text-monti-default",
				/** A `ghost` that deletes or empties something (empty the trash, delete forever): red words, the red wash under the pointer. */
				"ghost-danger":
					"bg-transparent px-monti-12 font-normal text-monti-danger not-data-loading:not-disabled:hover:bg-monti-danger-muted not-data-loading:not-disabled:active:bg-monti-danger-muted",
				/** The quiet version of `danger`. */
				"outline-danger":
					"border border-monti-danger px-[18px] font-semibold text-monti-danger not-data-loading:not-disabled:hover:bg-monti-danger-muted",
			},
			/**
			 * The control heights: `lg` 36px (the default: page headers, forms, dialogs); `md` 32px (side panels); `sm` 28px inside cards and toolbars;
			 * `xs` 24px where only a small one fits (a card's head, a chip row).
			 */
			size: {
				lg: "h-monti-control-lg text-monti-body",
				md: "h-monti-control-md px-[14px] text-monti-body",
				sm: "h-monti-control-sm px-monti-12 text-monti-note",
				xs: "h-monti-control-xs px-monti-8 text-monti-caption [&_svg:not([class*='size-'])]:size-3.5",
			},
		},
		// A loading pill pads by eye, not by a formula: the spinner sits 2px further from the left edge than from the top and bottom, and the right side is
		// tighter than the resting padding, so the pill does not look empty on the right.
		compoundVariants: [
			{
				size: "lg",
				variant: ["primary", "danger", "outline-danger"],
				class: "data-loading:pr-[15px] data-loading:pl-[13px]",
			},
			{ size: "lg", variant: "secondary", class: "data-loading:pr-[13px] data-loading:pl-[13px]" },
			{ size: "md", class: "data-loading:pr-[11px] data-loading:pl-[11px]" },
			{ size: "sm", class: "data-loading:pr-[9px] data-loading:pl-[10px]" },
			{ size: "xs", class: "data-loading:pr-[7px] data-loading:pl-[7px]" },
		],
		defaultVariants: { variant: "primary", size: "lg" },
	},
);

function Button({
	className,
	variant,
	size,
	loading = false,
	pendingLabel,
	width,
	disabled,
	href,
	target,
	rel,
	children,
	...props
}: ButtonPrimitive.Props &
	VariantProps<typeof buttonVariants> & {
		/** It goes to an address: an `<a>` that looks like the button ("How to connect"). */
		href?: string;
		target?: string;
		rel?: string;
		/**
		 * The button sends its form by a plain post (no script handles it): from the moment the form is sent until the next page comes it is
		 * `loading` and says this instead of its words ("Signing in…"). Coming back to the page (the browser's back) wakes it.
		 */
		pendingLabel?: React.ReactNode;
		/** Working on it: a spinner replaces the leading icon, the button keeps its fill (it is not dimmed like a disabled one) and cannot be pressed again. Put the progress in the label. */
		loading?: boolean;
		/** `full` spans its container (a stacked form, a narrow panel). */
		width?: "full";
	}) {
	const own = useRef<HTMLButtonElement>(null);
	const [sending, setSending] = useState(false);
	useEffect(() => {
		const form = own.current?.form;
		if (pendingLabel === undefined || !form) return;
		const sent = () => setSending(true);
		const back = () => setSending(false);
		form.addEventListener("submit", sent);
		window.addEventListener("pageshow", back);
		return () => {
			form.removeEventListener("submit", sent);
			window.removeEventListener("pageshow", back);
		};
	}, [pendingLabel]);
	const busy = loading || sending;
	return (
		<ButtonPrimitive
			ref={pendingLabel === undefined ? undefined : own}
			type={pendingLabel === undefined ? undefined : "submit"}
			data-slot="button"
			data-loading={busy || undefined}
			aria-busy={busy || undefined}
			disabled={disabled || busy}
			// Working is not "cannot be used": the button keeps the focus it was pressed with (`aria-disabled`, not the attribute, which would hand
			// the focus to the page) and takes no second press.
			focusableWhenDisabled={busy && !disabled}
			className={cn(buttonVariants({ variant, size }), width === "full" && "w-full", className)}
			{...(href === undefined
				? {}
				: {
						nativeButton: false,
						role: "link",
						// biome-ignore lint/a11y/useAnchorContent: the button's children go in the link.
						render: <a href={href} target={target} rel={rel} />,
					})}
			{...props}
			{...(busy && !disabled ? BUSY_GUARD : {})}
		>
			{busy && <Spinner className={size === "sm" || size === "xs" ? "size-3" : "size-3.5"} />}
			{sending ? pendingLabel : children}
		</ButtonPrimitive>
	);
}

export { Button };
