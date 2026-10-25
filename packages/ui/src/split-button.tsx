"use client";

import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "./button";
import { cn } from "./cn";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./dropdown-menu";
import { IconButton } from "./icon-button";

type Size = "xs" | "sm" | "default" | "lg";

/** The chevron half is a square of the main half's height. */
const MENU_SIZE = { xs: "icon-xs", sm: "icon-sm", default: "icon", lg: "icon-lg" } as const;

/**
 * A main action with a menu of its variants ("Publish" + "Republish with today's date"), joined into one control. Both halves share height, look
 * and outer radius; the chevron half is a square of the same height. Use this, not `ButtonGroup`, whenever one half opens a menu.
 * `menuLabel` names the chevron for screen readers and its tooltip; `menu` is the menu's items (`DropdownMenuItem`s).
 * `disabled` and `loading` apply to both halves.
 */
function SplitButton({
	children,
	onClick,
	id,
	variant = "default",
	size = "default",
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
	/** `default` solid, `secondary` a soft fill, `outline`. */
	variant?: "default" | "secondary" | "outline";
	size?: Size;
	disabled?: boolean;
	/** The main action is running: a spinner on the main half, and neither half can be pressed. */
	loading?: boolean;
	/** The chevron's name for screen readers, also shown as its tooltip. */
	menuLabel: string;
	/** The menu's items. */
	menu: ReactNode;
	/** Which edge of the control the menu lines up with. */
	align?: "start" | "center" | "end";
}) {
	const outline = variant === "outline";
	return (
		<div role="group" data-slot="split-button" className="inline-flex shrink-0 items-stretch">
			<Button
				id={id}
				type="button"
				variant={variant}
				size={size}
				disabled={disabled}
				loading={loading}
				onClick={onClick}
				className="rounded-r-none"
			>
				{children}
			</Button>
			{/* Solid halves are parted by a 1px strip of the page; outline halves share one border instead. */}
			{!outline && <span aria-hidden className="w-px shrink-0 bg-monti-page" />}
			<DropdownMenu>
				<IconButton
					label={menuLabel}
					side="bottom"
					variant={variant}
					size={MENU_SIZE[size]}
					disabled={disabled || loading}
					className={cn("rounded-l-none", outline && "border-l-0")}
					trigger={(button) => <DropdownMenuTrigger render={button} />}
				>
					<ChevronDown aria-hidden />
				</IconButton>
				<DropdownMenuContent align={align} width="md">
					{menu}
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
}

export { SplitButton };
