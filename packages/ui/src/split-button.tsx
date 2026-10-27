"use client";

import { Button as ButtonPrimitive } from "@base-ui/react/button";
import type { ReactNode } from "react";
import { Caret } from "./caret";
import { cn } from "./cn";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./dropdown-menu";
import { Spinner } from "./spinner";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";

// The focus ring is drawn inside each half, in the pill's own text color: an outer ring would be cut by the pill's `overflow-hidden`, and a
// faint one is lost on the ink.
const HALF =
	"inline-flex items-center border-0 bg-transparent font-semibold text-current outline-none focus-visible:ring-2 focus-visible:ring-monti-on-emphasis focus-visible:ring-inset disabled:pointer-events-none";

/**
 * A main action with a menu of its variants ("Publish" + "Republish with today's date") in one ink pill. The menu holds only other ways of
 * the same action; a first publish has no menu and is a plain primary `Button`. `menuLabel` names the caret half for screen readers and its
 * tooltip; `menu` is the menu's items (`DropdownMenuItem`s). `disabled` and `loading` apply to both halves.
 */
function SplitButton({
	children,
	onClick,
	id,
	disabled,
	loading,
	menuLabel,
	menu,
	align = "end",
}: {
	/** The main action's label. */
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
	/** Which edge of the control the menu lines up with. */
	align?: "start" | "center" | "end";
}) {
	const inert = disabled || loading;
	return (
		<div
			role="group"
			data-slot="split-button"
			className={cn(
				"inline-flex h-monti-control shrink-0 items-stretch overflow-hidden rounded-monti-full bg-monti-emphasis text-monti-body text-monti-on-emphasis",
				inert && "opacity-45",
			)}
		>
			<ButtonPrimitive
				id={id}
				type="button"
				data-slot="button"
				disabled={inert}
				aria-busy={loading || undefined}
				onClick={onClick}
				className={cn(HALF, "gap-monti-6 rounded-l-monti-full pr-monti-12 pl-[18px]")}
			>
				{loading && <Spinner size="sm" aria-hidden />}
				{children}
			</ButtonPrimitive>
			<DropdownMenu>
				<Tooltip>
					<TooltipTrigger
						render={
							<DropdownMenuTrigger
								render={
									<ButtonPrimitive
										type="button"
										aria-label={menuLabel}
										disabled={inert}
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
				<DropdownMenuContent align={align}>{menu}</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

export { SplitButton };
