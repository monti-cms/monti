"use client";

import { Button, cn, Skeleton } from "@monti-cms/ui";
import type { ReactNode } from "react";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "./action-menu";
import { LIST_PANE_WIDTH } from "./layout";
import { OPEN_ITEM } from "./side-panel";

/**
 * A list on the left and the open item's editor (or an empty state) on the right: the shape of the templates page and the AI tabs.
 * `list` is a {@link ListPane}; `children` is the right side, which scrolls on its own.
 */
export function MasterDetail({ list, children }: { list: ReactNode; children: ReactNode }) {
	return (
		<div className="flex min-h-0 flex-1 overflow-hidden">
			{list}
			<div className="flex min-w-0 flex-1 flex-col overflow-y-auto">{children}</div>
		</div>
	);
}

/**
 * The list column. While `loading` it shows `skeletonRows` placeholders; with no rows it shows `empty`. A `header` (a notice, a toolbar) sits above the rows.
 */
export function ListPane({
	label,
	loading = false,
	skeletonRows = 3,
	empty,
	header,
	className,
	children,
}: {
	label: string;
	loading?: boolean;
	skeletonRows?: number;
	/** Shown in place of the rows when `children` is empty (pass `null` while an error is showing instead). */
	empty?: ReactNode;
	header?: ReactNode;
	className?: string;
	children?: ReactNode;
}) {
	const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
	return (
		<div className={cn("flex shrink-0 flex-col border-monti-muted border-r", LIST_PANE_WIDTH, className)}>
			{header}
			<ul
				className={cn(
					"min-h-0 flex-1 divide-y divide-monti-muted overflow-y-auto overflow-x-hidden",
					!hasRows && !loading && "flex flex-col",
				)}
				aria-label={label}
			>
				{loading
					? Array.from({ length: skeletonRows }, (_, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: placeholder
							<li key={index} className="p-normal" aria-hidden>
								<Skeleton className="h-9 w-full" />
							</li>
						))
					: hasRows
						? children
						: empty && <li className="flex flex-1 items-center justify-center p-comfortable text-center">{empty}</li>}
			</ul>
		</div>
	);
}

/**
 * One row of a {@link ListPane}: the title with a status to its right, and a dim line under it. With `actions` the row also opens a context
 * menu and shows a `⋯` button; `onDelete` is called on the Delete key.
 */
export function ListRow({
	title,
	status,
	detail,
	current,
	onClick,
	actions,
	actionsLabel,
	onDelete,
	trailing,
}: {
	title: string;
	status?: ReactNode;
	detail?: ReactNode;
	current: boolean;
	onClick: () => void;
	actions?: MenuAction[];
	/** Name of the `⋯` button; required with `actions`. */
	actionsLabel?: string;
	onDelete?: () => void;
	trailing?: ReactNode;
}) {
	const button = (
		<Button
			variant="ghost"
			type="button"
			aria-current={current ? "true" : undefined}
			onClick={onClick}
			onKeyDown={(event) => {
				if (onDelete && event.key === "Delete") {
					event.preventDefault();
					onDelete();
				}
			}}
			className="h-auto min-w-0 flex-1 flex-col items-start gap-hair px-tight py-tight text-left font-normal hover:bg-transparent"
		>
			<span className="flex w-full items-center gap-condensed">
				<span className="truncate font-medium text-monti-body">{title}</span>
				{status && <span className="ml-auto shrink-0 text-monti-caption text-monti-muted">{status}</span>}
			</span>
			{detail && <span className="w-full truncate text-monti-caption text-monti-muted">{detail}</span>}
		</Button>
	);
	const rowClass = cn(
		"group flex items-center justify-between gap-condensed px-comfortable py-condensed transition-colors",
		current ? OPEN_ITEM : "hover:bg-monti-hover",
	);
	if (!actions || actions.length === 0) {
		return (
			<li className={rowClass}>
				{button}
				{trailing}
			</li>
		);
	}
	return (
		<ActionContextMenu actions={actions} trigger={<li className={rowClass} />}>
			{button}
			{trailing}
			<MoreActionsButton actions={actions} label={actionsLabel ?? title} />
		</ActionContextMenu>
	);
}
