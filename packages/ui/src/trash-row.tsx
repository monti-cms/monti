import type * as React from "react";
import { cn } from "./cn";
import { HIT_LAYER } from "./hit-area";
import { Folder } from "./icons";
import { Spark } from "./spark";

/**
 * The title cell of a trash row. Line one: the title in the quiet ink of what is out of use (a trashed folder has its folder icon before it), and its
 * address in mono beside it; line two: what it holds (`meta`: its languages, what a folder or file is, where it was), in the warning tone when something stops it
 * from coming back. A row with nothing to say there (an item) keeps the empty line, so every row of the list is as tall.
 * The title may be a {@link RowLink}: it covers the row, so a click anywhere on the row opens it.
 */
function TrashRowTitle({
	title,
	address,
	folder = false,
	meta,
	metaTone = "default",
	className,
	...props
}: Omit<React.ComponentProps<"span">, "title"> & {
	title: React.ReactNode;
	/** Beside the title: `/first-post`. */
	address?: React.ReactNode;
	/** The row is a folder: its icon leads the line. */
	folder?: boolean;
	meta?: React.ReactNode;
	/** `warning` when the row cannot be restored as it is (its original is in the trash). */
	metaTone?: "default" | "warning";
}) {
	return (
		<span data-slot="trash-row-title" className={cn("flex min-w-0 flex-col gap-monti-4", className)} {...props}>
			<span className="flex min-w-0 items-baseline gap-monti-12">
				{folder && <Folder aria-hidden size={16} className="shrink-0 self-center text-monti-subtle" />}
				<span className="min-w-0 truncate text-monti-body text-monti-muted [&_[data-slot=row-link]]:text-inherit">
					{title}
				</span>
				{address && <span className="truncate font-mono text-monti-faint text-monti-meta">{address}</span>}
			</span>
			<span
				data-slot="trash-row-meta"
				className={cn("truncate text-monti-note", metaTone === "warning" ? "text-monti-warning" : "text-monti-subtle")}
			>
				{meta || "\u00a0"}
			</span>
		</span>
	);
}

/**
 * The date cell of a trash row, at the end of its cell: how long it stays ("30 days left"), and over it the day it was discarded when `date` is
 * given ("10. 27"; the column's name says what the day is). The trash list gives only the days left: the day it was thrown away says the same
 * thing twice. The days turn to the warning tone when `urgent` (under a week, the screen decides): the purge is near. What the assistant discarded is blue after
 * a ✦ (`byAssistant`, on the day, or on the days left when there is no day); with `onOpen` it is a button that opens the conversation. Without it the ✦
 * alone is blue when the days are `urgent`: they keep the warning tone.
 */
function TrashRowDate({
	date,
	left,
	urgent = false,
	byAssistant,
	className,
	...props
}: Omit<React.ComponentProps<"span">, "children"> & {
	/** The day ("10. 27"); left out where the days left say enough (the trash list). */
	date?: React.ReactNode;
	/** Time left before the purge ("30 days left"). */
	left: React.ReactNode;
	urgent?: boolean;
	/**
	 * The assistant discarded it: the day is blue with a ✦ before it. `label` says so to a screen reader ("The assistant threw it away"). With `onOpen` it
	 * is a button that opens that conversation, and `label` names the button ("Open the conversation that discarded it").
	 */
	byAssistant?: { label: string; onOpen?: () => void };
}) {
	// In a column dragged narrow the words end in "…" and the mark stays: each piece may shrink to the cell.
	const MARK = "inline-flex min-w-0 max-w-full items-center gap-monti-4 font-mono text-monti-meta text-monti-proposal";
	const assistant = (words: React.ReactNode) =>
		!byAssistant ? null : byAssistant.onOpen ? (
			<button
				type="button"
				aria-label={byAssistant.label}
				onClick={byAssistant.onOpen}
				className={cn(
					MARK,
					HIT_LAYER,
					"relative z-10 cursor-pointer border-0 bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-monti-contrast/50",
				)}
			>
				<Spark aria-hidden className="size-monti-icon-xs shrink-0" />
				<span className="truncate">{words}</span>
			</button>
		) : (
			<span data-slot="trash-row-left" className={MARK}>
				<Spark role="img" aria-hidden={false} aria-label={byAssistant.label} className="size-monti-icon-xs shrink-0" />
				{/* The mark says who; the days still say how near the purge is. */}
				<span className={cn("truncate", urgent && date === undefined && "text-monti-warning")}>{words}</span>
			</span>
		);
	return (
		<span
			data-slot="trash-row-date"
			className={cn("inline-flex min-w-0 max-w-full flex-col items-end gap-monti-4", className)}
			{...props}
		>
			{date !== undefined &&
				(assistant(date) ?? (
					<span className="max-w-full truncate font-mono text-monti-meta text-monti-subtle">{date}</span>
				))}
			{(date === undefined && assistant(left)) || (
				<span
					data-slot="trash-row-left"
					className={cn(
						"max-w-full truncate font-mono text-monti-meta",
						urgent ? "text-monti-warning" : "text-monti-faint",
					)}
				>
					{left}
				</span>
			)}
		</span>
	);
}

export { TrashRowDate, TrashRowTitle };
