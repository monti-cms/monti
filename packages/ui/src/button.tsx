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
	"group/button inline-flex shrink-0 items-center justify-center gap-monti-6 rounded-monti-full whitespace-nowrap outline-none transition-colors select-none focus-visible:ring-2 focus-visible:ring-monti-contrast/60 cursor-pointer disabled:pointer-events-none disabled:opacity-45 aria-disabled:pointer-events-none aria-disabled:opacity-45 data-held:pointer-events-auto data-held:cursor-default data-loading:pointer-events-auto data-loading:cursor-default data-loading:opacity-100 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&>svg:first-child]:-ml-[2px] not-data-reserved:data-loading:gap-[7px] data-loading:[&>[data-slot=spinner]+svg]:hidden",
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
				/** A `ghost` that deletes (a sheet foot's "delete", a question's risky way out): red words, the red wash under the pointer. Standing alone in a page head or a danger block it is `outline-danger`. */
				"ghost-danger":
					"bg-transparent px-monti-12 font-normal text-monti-danger not-data-loading:not-disabled:hover:bg-monti-danger-muted not-data-loading:not-disabled:active:bg-monti-danger-muted",
				/** The quiet version of `danger`: a deleting button outside a dialog that stands alone (empty the trash, delete the collection). */
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
				class: "not-data-reserved:data-loading:pr-[15px] not-data-reserved:data-loading:pl-[13px]",
			},
			{
				size: "lg",
				variant: "secondary",
				class: "not-data-reserved:data-loading:pr-[13px] not-data-reserved:data-loading:pl-[13px]",
			},
			{ size: "md", class: "not-data-reserved:data-loading:pr-[11px] not-data-reserved:data-loading:pl-[11px]" },
			{ size: "sm", class: "not-data-reserved:data-loading:pr-[9px] not-data-reserved:data-loading:pl-[10px]" },
			{ size: "xs", class: "not-data-reserved:data-loading:pr-[7px] not-data-reserved:data-loading:pl-[7px]" },
		],
		defaultVariants: { variant: "primary", size: "lg" },
	},
);

/**
 * A label that is as wide as the widest of the labels it can take: the others are laid under it, unseen, in the same place. What stands beside a
 * button whose words change ("Publish", "Published") then stays put when they do. Each label is also laid once more with the spinner before it (the
 * row of a button that works: spinner, gap, words), so the width holds while it works too. The spinner is drawn in this stack's own row, at its
 * normal size, so a reserved button shows loading as any other does.
 */
export function ReservedLabel({
	children,
	reserve,
	spinner,
	spinnerSize,
}: {
	children: React.ReactNode;
	reserve?: string[];
	/** The spinner while the button works: it stands before the words, in the row. */
	spinner?: React.ReactNode;
	/** The class that sizes the spinner, so its ghost takes the room the spinner does. */
	spinnerSize: string;
}) {
	const row = (words: React.ReactNode) => (
		<span className="inline-flex items-center gap-[7px] [&>svg]:hidden">
			{spinner}
			{words}
		</span>
	);
	// Without `reserve` the button draws its spinner itself, before its words, in place of its leading icon.
	if (!reserve || reserve.length === 0) return children;
	return (
		<span className="inline-grid justify-items-center *:col-start-1 *:row-start-1">
			<span>{spinner ? row(children) : children}</span>
			{reserve.map((label) => (
				// Drawn by the stylesheet from the attribute, so the words are not in the button's text: a screen reader and a test read the one label.
				<span key={label} aria-hidden data-label={label} className="invisible after:content-[attr(data-label)]" />
			))}
			{reserve.map((label) => (
				<span key={`working ${label}`} aria-hidden className="invisible inline-flex items-center gap-[7px]">
					<span className={spinnerSize} />
					<span data-label={label} className="after:content-[attr(data-label)]" />
				</span>
			))}
		</span>
	);
}

function Button({
	className,
	variant,
	size,
	loading = false,
	pendingLabel,
	width,
	reserve,
	disabled,
	focusableWhenDisabled,
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
		/**
		 * With `disabled`: the button stays where the keyboard stops. It is `aria-disabled`, not the attribute: it looks as any disabled button,
		 * takes no press, and a pointer's press stops on it (it does not go through to what is under it). For a button its own press turns off,
		 * so that the focus does not fall to the page: the editor's publish button ("Published") always has it, as the split button's main half does.
		 */
		focusableWhenDisabled?: boolean;
		/** Working on it: a spinner replaces the leading icon, the button keeps its fill (it is not dimmed like a disabled one) and cannot be pressed again. Put the progress in the label. */
		loading?: boolean;
		/** `full` spans its container (a stacked form, a narrow panel). */
		width?: "full";
		/** The other labels this button takes (the changing words of one action): it is as wide as the widest, so its neighbours do not move when the words change. */
		reserve?: string[];
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
	const spinnerSize = size === "sm" || size === "xs" ? "size-3" : "size-3.5";
	// Off, and still holding the focus: working, or turned off by its own press (`focusableWhenDisabled`).
	const held = (busy && !disabled) || Boolean(disabled && focusableWhenDisabled);
	return (
		<ButtonPrimitive
			ref={pendingLabel === undefined ? undefined : own}
			type={pendingLabel === undefined ? undefined : "submit"}
			data-slot="button"
			data-loading={busy || undefined}
			data-reserved={(reserve !== undefined && reserve.length > 0) || undefined}
			data-held={(held && !busy) || undefined}
			aria-busy={busy || undefined}
			disabled={disabled || busy}
			// Working is not "cannot be used": the button keeps the focus it was pressed with (`aria-disabled`, not the attribute, which would hand
			// the focus to the page) and takes no second press.
			focusableWhenDisabled={held}
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
			{...(held ? BUSY_GUARD : {})}
		>
			{busy && !(reserve !== undefined && reserve.length > 0) && <Spinner className={spinnerSize} />}
			<ReservedLabel
				reserve={reserve}
				spinnerSize={spinnerSize}
				spinner={busy && reserve !== undefined && reserve.length > 0 ? <Spinner className={spinnerSize} /> : undefined}
			>
				{sending ? pendingLabel : children}
			</ReservedLabel>
		</ButtonPrimitive>
	);
}

export { Button };
