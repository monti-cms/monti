"use client";

import { Popover as PopoverPrimitive } from "@base-ui/react/popover";
import { Check } from "lucide-react";
import type * as React from "react";
import { Spark } from "./ai-action";
import { cn } from "./cn";
import { Count } from "./count";
import { MENU_CARD, MENU_LABEL, MENU_MOTION } from "./menu-parts";

/**
 * The list that opens upward from a status bar cell ("To fix 3"): a card with the group's name and its count in the head, then the rows to
 * fix ({@link TodoItem}) and the ones already done ({@link TodoDone}). `trigger` is the cell that opens it.
 */
function SheetList({
	trigger,
	label,
	count,
	countTone = "warning",
	open,
	defaultOpen,
	onOpenChange,
	align = "start",
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
	children: React.ReactNode;
}) {
	return (
		<PopoverPrimitive.Root open={open} defaultOpen={defaultOpen} onOpenChange={onOpenChange}>
			<PopoverPrimitive.Trigger render={trigger} />
			<PopoverPrimitive.Portal>
				<PopoverPrimitive.Positioner side="top" align={align} sideOffset={6} className="isolate z-50">
					<PopoverPrimitive.Popup
						data-slot="sheet-list"
						className={cn(
							MENU_CARD,
							MENU_MOTION,
							"z-50 max-h-(--available-height) w-85 overflow-y-auto p-monti-6 text-left",
						)}
					>
						<div data-slot="sheet-list-head" className={MENU_LABEL}>
							<span>{label}</span>
							<Count tone={countTone}>{count}</Count>
						</div>
						{children}
					</PopoverPrimitive.Popup>
				</PopoverPrimitive.Positioner>
			</PopoverPrimitive.Portal>
		</PopoverPrimitive.Root>
	);
}

/**
 * One thing to fix: a ring, the title, one short line under it, and the one action that goes to it at the right. `blocking` draws the ring in
 * red for what stops publishing; the others are warning-colored. `marker` replaces the ring with a `Marker` (a translated block whose source changed).
 * `current` is the row whose place is open on the page. `proposal` puts a spark in front of the action and makes it blue: the assistant does it.
 */
function TodoItem({
	title,
	detail,
	blocking = false,
	marker,
	current = false,
	actionLabel,
	onAction,
	proposal = false,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "title"> & {
	title: React.ReactNode;
	/** One line under the title; a longer one is cut. */
	detail?: React.ReactNode;
	/** Stops publishing. */
	blocking?: boolean;
	/** A `Marker` in front of the title, instead of the ring. */
	marker?: React.ReactNode;
	current?: boolean;
	actionLabel?: string;
	onAction?: () => void;
	/** The action is the assistant's. */
	proposal?: boolean;
}) {
	return (
		<div
			data-slot="todo-item"
			data-current={current || undefined}
			className={cn(
				"flex items-center gap-[10px] rounded-monti-md px-[9px] py-monti-8 text-monti-body text-monti-default data-current:bg-monti-selected",
				className,
			)}
			{...props}
		>
			{marker ? (
				<span data-slot="todo-mark" className="flex min-w-11 shrink-0 justify-center">
					{marker}
				</span>
			) : (
				<span
					aria-hidden
					data-slot="todo-mark"
					data-blocking={blocking || undefined}
					className={cn(
						"size-3.5 shrink-0 rounded-monti-full border-[1.5px] border-monti-warning",
						blocking && "border-monti-danger",
					)}
				/>
			)}
			<span className="flex min-w-0 grow flex-col gap-monti-2">
				<span>{title}</span>
				{detail && <span className="truncate text-monti-caption text-monti-subtle">{detail}</span>}
			</span>
			{actionLabel && (
				<button
					type="button"
					onClick={onAction}
					className={cn(
						"inline-flex shrink-0 cursor-pointer items-center gap-monti-4 border-0 bg-transparent p-0 text-monti-note outline-none focus-visible:rounded-monti-sm focus-visible:ring-2 focus-visible:ring-monti-contrast/20",
						proposal ? "text-monti-proposal" : "text-monti-muted",
					)}
				>
					{proposal && <Spark />}
					{actionLabel}
				</button>
			)}
		</div>
	);
}

/** A thing that is already right: a green ✓ and one small line, under the rows to fix. */
function TodoDone({ className, children, ...props }: React.ComponentProps<"div">) {
	return (
		<div
			data-slot="todo-done"
			className={cn(
				"flex items-center gap-monti-8 px-[9px] pt-monti-6 pb-monti-4 text-monti-caption text-monti-subtle",
				className,
			)}
			{...props}
		>
			<Check aria-hidden className="size-3.5 shrink-0 text-monti-success" />
			{children}
		</div>
	);
}

export { SheetList, TodoDone, TodoItem };
