import { cva } from "class-variance-authority";
import type * as React from "react";
import { cn } from "./cn";

/**
 * Where an entry stands, or a delivery. The meaning is the shape and the name together, never the color alone:
 * `published` a filled dot, `editing` a filled dot in the warning mark color (its name stays in the warning text color) (published, with changes not published yet), `draft` an empty ring,
 * `archived` a short bar, `failed` a filled dot in red.
 */
type EntryStatusKind = "published" | "editing" | "draft" | "archived" | "failed";

const COLOR: Record<EntryStatusKind, string> = {
	published: "text-monti-success",
	editing: "text-monti-warning",
	draft: "text-monti-muted",
	archived: "text-monti-subtle",
	failed: "text-monti-danger",
};

const markVariants = cva("box-border w-[7px] shrink-0 rounded-monti-full bg-current", {
	variants: {
		status: {
			published: "h-[7px]",
			editing: "h-[7px] bg-monti-warning-emphasis",
			failed: "h-[7px]",
			draft: "h-[7px] border-[1.5px] border-current bg-transparent",
			archived: "h-0.5 rounded-none",
		},
	},
});

/**
 * The status of an entry in a list, beside its address in the editor, or a delivery in the event log: a 7px mark and the status name. Without
 * `children` it is the mark alone (a language's tab), decorative, so say the status in words nearby or on the parent. It has no version for a dark
 * pill: on ink every status would take the same color, and the shapes of three of them are alike. It is drawn on the page or a tool surface.
 */
function EntryStatus({
	status,
	quiet = false,
	className,
	children,
	...props
}: Omit<React.ComponentProps<"span">, "children"> & {
	status: EntryStatusKind;
	/** The usual case in a column of statuses (a published entry in a list): the subtle tone and the normal weight, so the others stand out. */
	quiet?: boolean;
	/** The status name. */
	children?: React.ReactNode;
}) {
	return (
		<span
			data-slot="entry-status"
			data-status={status}
			className={cn(
				"inline-flex items-center gap-[7px] whitespace-nowrap font-medium text-monti-note",
				quiet ? "font-normal text-monti-subtle" : COLOR[status],
				className,
			)}
			{...props}
		>
			<span aria-hidden="true" data-slot="entry-status-mark" className={markVariants({ status })} />
			{children}
		</span>
	);
}

export { EntryStatus, type EntryStatusKind };
