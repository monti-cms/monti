"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import * as React from "react";
import { cn } from "./cn";
import { Count } from "./count";
import { MENU_CARD, MENU_LABEL, MENU_MOTION, MENU_SEPARATOR } from "./menu-parts";

/**
 * The list that opens upward from a status bar cell ("To do 3"): a card with the group's name and its count in the head (no count once nothing is
 * left), then the rows to do (`TodoItem`) and the ones already done (`TodoDone`), and under a rule the actions that belong to the whole list
 * (`footer`: a link to its settings, "Fix all"). `trigger` is the cell that opens it.
 */
function StatusBarList({
	trigger,
	label,
	count,
	countTone = "warning",
	open,
	defaultOpen,
	onOpenChange,
	align = "start",
	footer,
	children,
}: {
	/** The element that opens the list; it receives the open state and the press. */
	trigger: React.ReactElement;
	/** The group's name. */
	label: string;
	/** How many rows need work. */
	count: number;
	/** `danger` while any of them blocks publishing. */
	countTone?: "warning" | "danger";
	open?: boolean;
	defaultOpen?: boolean;
	onOpenChange?: (open: boolean) => void;
	align?: "start" | "end";
	/** Text buttons for the whole list, under a rule: they sit at the two ends of the row. */
	footer?: React.ReactNode;
	children: React.ReactNode;
}) {
	// Focus lands on the card itself, not on its first row's action: the row's focus ring would otherwise show as a box around it when the list
	// opens (and with `defaultOpen`). Tab then goes row by row.
	const popup = React.useRef<HTMLDivElement>(null);
	return (
		<PopoverPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
			<PopoverPrimitive.Trigger render={trigger} />
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Positioner side="top" align={align} sideOffset={6} className="isolate z-50">
					<PopoverPrimitive.Popup
						ref={popup}
						initialFocus={popup}
						data-slot="status-bar-list"
						className={cn(
							MENU_CARD,
							MENU_MOTION,
							"z-50 max-h-(--available-height) w-85 overflow-y-auto p-monti-6 text-left outline-none",
						)}
					>
						<div data-slot="status-bar-list-head" className={MENU_LABEL}>
							<PopoverPrimitive.Title render={<span />}>{label}</PopoverPrimitive.Title>
							{count > 0 && <Count tone={countTone}>{count}</Count>}
						</div>
						{children}
						{footer && (
							<>
								<div aria-hidden className={MENU_SEPARATOR} />
								<div
									data-slot="status-bar-list-foot"
									className="flex items-center justify-between gap-monti-12 px-[9px] pt-monti-4 pb-monti-4 text-monti-note"
								>
									{footer}
								</div>
							</>
						)}
					</PopoverPrimitive.Popup>
				</PopoverPrimitive.Positioner>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}

export { StatusBarList };
