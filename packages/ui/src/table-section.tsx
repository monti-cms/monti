import type * as React from "react";
import { useId } from "react";
import { cn } from "./cn";
import { Count } from "./count";

/**
 * A titled table of a tools page (API keys: saved keys · models · plugins): the title in label type, bold, with a count after it, a line under it, then
 * its {@link TableSectionRow}s. The first section sits 32px under the page's toolbar, the next ones 40px under the table above.
 */
function TableSection({
	title,
	count,
	countTone = "default",
	children,
	...props
}: Omit<React.ComponentProps<"section">, "title" | "className" | "style" | "aria-labelledby"> & {
	title: React.ReactNode;
	/** How many rows, or how many need attention (`countTone="warning"`). */
	count?: React.ReactNode;
	countTone?: "default" | "warning";
}) {
	const titleId = useId();
	return (
		<section data-slot="table-section" aria-labelledby={titleId} className="mt-monti-40 first:mt-monti-32" {...props}>
			<h2
				id={titleId}
				className="m-0 flex items-baseline gap-monti-8 border-monti-default border-b px-monti-12 pb-monti-12 font-bold text-monti-label"
			>
				{title}
				{count !== undefined && count !== null && <Count tone={countTone}>{count}</Count>}
			</h2>
			<div role="list">{children}</div>
		</section>
	);
}

/**
 * One row of a {@link TableSection}: a title (body text in ink, or `muted`) with an optional count after it ("··· a1b2"), a meta line under it, and at
 * the end either text buttons (`actions`, each its own column) or one 320px control (`control`, a select or a model field).
 */
function TableSectionRow({
	title,
	titleCount,
	detail,
	meta,
	metaTone = "muted",
	muted = false,
	actions,
	control,
	labelId,
	...props
}: Omit<React.ComponentProps<"div">, "title" | "className" | "style" | "children"> & {
	title: React.ReactNode;
	/** A short count after the title, in mono (the key's last characters). */
	titleCount?: React.ReactNode;
	/** A second, quieter part of the title after a dot ("· Search key"). */
	detail?: React.ReactNode;
	meta?: React.ReactNode;
	/** `faint` for a row that has nothing to report, `danger` for one that cannot be used, `subtle` for an identifier. */
	metaTone?: "muted" | "subtle" | "faint" | "danger";
	/** The title in muted ink (a key that is not used). */
	muted?: boolean;
	/** Text buttons at the end, one column each. */
	actions?: React.ReactNode;
	/** One control at the end, 320px wide, named by the title (`labelId` goes on the title for its `aria-labelledby`). */
	control?: React.ReactNode;
	labelId?: string;
}) {
	return (
		<div
			role="listitem"
			data-slot="table-section-row"
			className={cn(
				"relative grid items-center gap-monti-20 border-monti-muted border-b px-monti-12 py-monti-16 hover:bg-monti-muted",
				control ? "grid-cols-[minmax(0,1fr)_320px]" : "auto-cols-auto grid-flow-col grid-cols-[minmax(0,1fr)]",
			)}
			{...props}
		>
			<span className="flex min-w-0 flex-col gap-monti-4">
				<span
					id={labelId}
					className={cn("truncate text-monti-body", muted ? "text-monti-muted" : "text-monti-default")}
				>
					{title}
					{detail && <span className="text-monti-muted"> · {detail}</span>}
					{titleCount !== undefined && <Count className="ml-monti-4">{titleCount}</Count>}
				</span>
				{meta !== undefined && (
					<span
						className={cn(
							"mt-monti-2 truncate font-mono text-monti-meta",
							metaTone === "muted" && "text-monti-muted",
							metaTone === "subtle" && "text-monti-subtle",
							metaTone === "faint" && "text-monti-faint",
							metaTone === "danger" && "text-monti-danger",
						)}
					>
						{meta}
					</span>
				)}
			</span>
			{control ?? actions}
		</div>
	);
}

export { TableSection, TableSectionRow };
