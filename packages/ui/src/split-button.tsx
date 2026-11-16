"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { BUSY_GUARD } from "./busy";
import { ReservedLabel } from "./button";
import { Caret } from "./caret";
import { cn } from "./cn";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./dropdown-menu";
import { Spinner } from "./spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

// The pill is one shape, so its focus ring goes round the whole pill (the container, which `overflow-hidden` does not clip: it clips what is inside it),
// and the half that has the focus is marked by a lighter fill, not by a line of its own.
const HALF =
	"inline-flex items-center border-0 bg-transparent font-semibold text-current outline-none transition-colors focus-visible:bg-[color-mix(in_srgb,var(--monti-fg-on-emphasis)_16%,transparent)] cursor-pointer disabled:pointer-events-none aria-disabled:cursor-default";

/**
 * A main action with a menu of its variants ("Publish" + "Republish with today's date") in one ink pill. The menu holds only other ways of
 * the same action; a first publish has no menu and is a plain primary `Button`. `menuLabel` names the caret half for screen readers and its
 * tooltip; `menu` is the menu's items (`DropdownMenuItem`s). `disabled` and `loading` apply to both halves; a loading pill keeps its fill, and its label says what is happening.
 * A pill that cannot be pressed keeps the keyboard's focus: its main half is `aria-disabled`, not off, so a publish that ends in "Published"
 * does not hand the focus to the page. The caret half of a disabled pill is off and out of the tab order; had it the focus, the main half takes it.
 */
function SplitButton({
	children,
	onClick,
	id,
	disabled,
	loading,
	menuLabel,
	menu,
	reserve,
	align = "end",
}: {
	/** The main action's label, with its leading icon first if it has one (`<Add aria-hidden />`). */
	children: ReactNode;
	onClick?: () => void;
	/** The main button's `id`, for a skip link or a keyboard shortcut to find it. */
	id?: string;
	disabled?: boolean;
	/** The main action is running: a spinner on the main half, and neither half can be pressed. */
	loading?: boolean;
	/** The caret half's name for screen readers, also shown as its tooltip. */
	menuLabel: string;
	/** The menu's items. */
	menu: ReactNode;
	/** The other labels the main half takes: it is as wide as the widest, so its neighbours do not move when the words change. */
	reserve?: string[];
	/** Which edge of the control the menu lines up with. */
	align?: "start" | "center" | "end";
}) {
	const inert = disabled || loading;
	// A pill that cannot be pressed shows no menu, whatever reaches its caret half (TR-29).
	const [open, setOpen] = useState(false);
	// What was open is forgotten too: a pill that can be pressed again does not come back with its menu.
	if (inert && open) setOpen(false);
	const main = useRef<HTMLButtonElement>(null);
	const caret = useRef<HTMLButtonElement>(null);
	// The caret half goes off with the pill. The focus it held (a publish started from the menu) goes to the main half, not to the page. The
	// mark is used once, and only a focus that is still on the caret half or has fallen to the page is moved: one the person has since put
	// elsewhere (the title they went on to write) stays where it is.
	const caretHeld = useRef(false);
	useLayoutEffect(() => {
		if (!disabled) return;
		const held = caretHeld.current;
		caretHeld.current = false;
		const at = document.activeElement;
		if (held && (at === null || at === document.body || at === caret.current)) main.current?.focus();
	}, [disabled]);
	// The menu hangs under the whole pill, not under the caret half: its edge lines up with the pill's edge.
	const pill = useRef<HTMLDivElement>(null);
	return (
		<div
			ref={pill}
			role="group"
			data-slot="split-button"
			className={cn(
				"inline-flex h-monti-control-lg shrink-0 items-stretch overflow-hidden rounded-monti-full bg-monti-emphasis text-monti-body text-monti-on-emphasis has-focus-visible:ring-2 has-focus-visible:ring-monti-contrast/50",
				disabled && "opacity-45",
			)}
		>
			<ButtonPrimitive
				ref={main}
				id={id}
				type="button"
				data-slot="button"
				disabled={inert}
				// Working or off: the half keeps the focus (`aria-disabled`, not the attribute) and takes no press.
				focusableWhenDisabled
				aria-busy={loading || undefined}
				onClick={onClick}
				{...(inert ? BUSY_GUARD : {})}
				// A leading icon ("+" of "New post") is 16px and pulled 2px into the left padding, as on a `Button`; while it works the spinner takes its place.
				className={cn(
					HALF,
					"gap-monti-6 rounded-l-monti-full pr-monti-12 pl-[18px] [&>svg:first-child]:-ml-[2px] [&_svg]:size-4 [&_svg]:shrink-0",
					// A pill with `reserve` keeps its padding and gap while it works: the room is the stack's, and the spinner stands in its row.
					loading && !(reserve && reserve.length > 0) && "gap-[7px] pl-[13px] [&>[data-slot=spinner]+svg]:hidden",
				)}
			>
				{loading && !(reserve && reserve.length > 0) && <Spinner />}
				<ReservedLabel
					reserve={reserve}
					spinnerSize="size-3.5"
					spinner={loading && reserve && reserve.length > 0 ? <Spinner /> : undefined}
				>
					{children}
				</ReservedLabel>
			</ButtonPrimitive>
			<DropdownMenu open={open && !inert} onOpenChange={setOpen}>
				<Tooltip>
					<TooltipTrigger
						render={
							<DropdownMenuTrigger
								render={
									<ButtonPrimitive
										ref={caret}
										type="button"
										aria-label={menuLabel}
										onFocus={() => {
											caretHeld.current = true;
										}}
										onBlur={() => {
											// Turned off while it had the focus, the browser takes the focus from it: that is not the person leaving it.
											if (!caret.current?.disabled) caretHeld.current = false;
										}}
										disabled={inert}
										// Working: a publish started from the menu came back to this half, and it keeps the focus as the main half does.
										focusableWhenDisabled={Boolean(loading) && !disabled}
										{...(loading && !disabled ? BUSY_GUARD : {})}
										className={cn(HALF, "relative rounded-r-monti-full pr-[13px] pl-monti-12")}
									/>
								}
							/>
						}
					>
						<span aria-hidden className="absolute top-1/2 left-0 h-3.5 -translate-y-1/2 border-monti-faint border-l" />
						<Caret solo ink />
					</TooltipTrigger>
					<TooltipContent side="bottom">{menuLabel}</TooltipContent>
				</Tooltip>
				<DropdownMenuContent
					align={align}
					anchor={pill}
					// A row that turned the pill off (the publish ended in "Published"): the caret half cannot take the focus back, so the main half does.
					finalFocus={() => (caret.current?.disabled ? main.current : true)}
				>
					{menu}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

export { SplitButton };
