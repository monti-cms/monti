import { Folder } from "@carbon/icons-react";
import type * as React from "react";
import { cn } from "./cn";

/**
 * The title cell of a trash row. Line one: the title in the quiet ink of what is out of use (a trashed folder has its folder icon before it), and its
 * address in mono beside it; line two: what it is (`meta`: its kind, languages and where it was), in the warning tone when something stops it from coming back.
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
			{meta && (
				<span
					data-slot="trash-row-meta"
					className={cn(
						"truncate text-monti-note",
						metaTone === "warning" ? "text-monti-warning" : "text-monti-subtle",
					)}
				>
					{meta}
				</span>
			)}
		</span>
	);
}

/**
 * The date cell of a trash row, at the end of its cell: the day it was discarded with the word for it ("10. 27 discarded") over how long it stays
 * ("30 days left"). The days turn to the warning tone when `urgent` (three or fewer): the purge is near.
 */
function TrashRowDate({
	date,
	left,
	urgent = false,
	className,
	...props
}: Omit<React.ComponentProps<"span">, "children"> & {
	/** The day and the word for it ("10. 27 discarded"). */
	date: React.ReactNode;
	/** Time left before the purge ("30 days left"). */
	left: React.ReactNode;
	urgent?: boolean;
}) {
	return (
		<span data-slot="trash-row-date" className={cn("inline-flex flex-col items-end gap-monti-4", className)} {...props}>
			<span className="font-mono text-monti-meta text-monti-subtle">{date}</span>
			<span
				data-slot="trash-row-left"
				className={cn("font-mono text-monti-meta", urgent ? "text-monti-warning" : "text-monti-faint")}
			>
				{left}
			</span>
		</span>
	);
}

export { TrashRowDate, TrashRowTitle };
