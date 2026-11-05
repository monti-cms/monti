import type * as React from "react";
import { useId } from "react";
import { cn } from "./cn";
import { Count } from "./count";

/**
 * A titled list of rows: the title in label type, bold, with a count after it, a line under it, then its rows: {@link ListSectionRow}s on a tools page
 * (API keys: saved keys · models · plugins), `ChangeGroup`s in a review sheet ("바로 저장 2", "PR 1"). It keeps no room around itself; the page or (cms-allow-korean)
 * sheet spaces its sections.
 */
function ListSection({
	title,
	count,
	countTone = "default",
	flush = false,
	children,
	...props
}: Omit<React.ComponentProps<"section">, "title" | "className" | "style" | "aria-labelledby"> & {
	title: React.ReactNode;
	/** How many rows, or how many need attention (`countTone="warning"`). */
	count?: React.ReactNode;
	countTone?: "default" | "warning";
	/** The rows have no inset of their own (a review sheet's changes): the title starts at the edge with them, not 12px in, and the list keeps 16px under the line, since the first change block has none above. */
	flush?: boolean;
}) {
	const titleId = useId();
	return (
		<section data-slot="list-section" aria-labelledby={titleId} {...props}>
			<h2
				id={titleId}
				className={cn(
					"m-0 flex items-baseline gap-monti-8 border-monti-default border-b pb-monti-12 font-semibold text-monti-label",
					!flush && "px-monti-12",
				)}
			>
				{title}
				{count !== undefined && count !== null && <Count tone={countTone}>{count}</Count>}
			</h2>
			<div role="list" className={cn(flush && "pt-monti-16")}>
				{children}
			</div>
		</section>
	);
}

/**
 * One row of a {@link ListSection}: a title (body text in ink, or `muted`) with an optional count after it ("··· a1b2"), a meta line under it, and at
 * the end either text buttons (`actions`, each its own column) or one 320px control (`control`, a select or a model field). A row has one fixed height
 * for its kind, whatever it ends in: 52px for a title alone, 74px for a title with a meta line (its line inside). A control (36px) stands in the row
 * without making it taller.
 */
function ListSectionRow({
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
			data-slot="list-section-row"
			className={cn(
				"relative grid items-center gap-monti-20 border-monti-muted border-b px-monti-12",
				meta !== undefined ? "h-[74px]" : "h-[52px]",
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

export { ListSection, ListSectionRow };
