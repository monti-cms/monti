"use client";

import { Box, Inline, ResizablePane, Skeleton, Stack, Text, TextButton } from "@monti-cms/ui";
import type { ReactNode } from "react";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "./action-menu";

/**
 * A list on the left and the open item's editor (or an empty state) on the right: the shape of the templates page and the AI tabs.
 * `list` is a {@link ListPane}; `children` is the right side, which scrolls on its own.
 */
export function MasterDetail({ list, children }: { list: ReactNode; children: ReactNode }) {
	return (
		<Inline align="stretch" gap={0} grow minHeight={0} overflow="hidden">
			{list}
			<Stack gap={0} grow minWidth={0} overflow="y">
				{children}
			</Stack>
		</Inline>
	);
}

/**
 * The list column. While `loading` it shows `skeletonRows` placeholders; with no rows it shows `empty`. A `header` (a notice, a toolbar) sits above the rows.
 * Its width can be dragged (224 to 384px, 288px by default) and is remembered under `resizeKey`.
 */
export function ListPane({
	label,
	resizeKey = "list",
	loading = false,
	skeletonRows = 3,
	empty,
	header,
	children,
}: {
	label: string;
	/** Names the remembered width: one per list (the templates list, each AI tab). */
	resizeKey?: string;
	loading?: boolean;
	skeletonRows?: number;
	/** Shown in place of the rows when `children` is empty (pass `null` while an error is showing instead). */
	empty?: ReactNode;
	header?: ReactNode;
	children?: ReactNode;
}) {
	const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
	return (
		<ResizablePane resizeKey={`list-pane:${resizeKey}`} defaultWidth={288} min={224} max={384}>
			{header}
			<Stack as="ul" gap={0} grow minHeight={0} overflow="y" aria-label={label}>
				{loading
					? Array.from({ length: skeletonRows }, (_, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: placeholder
							<Box as="li" key={index} padding={12} aria-hidden>
								<Skeleton shape="control" />
							</Box>
						))
					: hasRows
						? children
						: empty && (
								<Stack as="li" grow align="center" justify="center" padding={16}>
									{empty}
								</Stack>
							)}
			</Stack>
		</ResizablePane>
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
		<Stack gap={0} grow minWidth={0}>
			<TextButton
				aria-current={current ? "true" : undefined}
				onClick={onClick}
				onKeyDown={(event) => {
					if (onDelete && event.key === "Delete") {
						event.preventDefault();
						onDelete();
					}
				}}
				render={<button type="button" />}
			>
				<Stack gap={2}>
					<Inline gap={8} justify="between">
						<Text weight="medium" truncate>
							{title}
						</Text>
						{status && (
							<Text variant="caption" tone="muted">
								{status}
							</Text>
						)}
					</Inline>
					{detail && (
						<Text variant="caption" tone="muted" truncate>
							{detail}
						</Text>
					)}
				</Stack>
			</TextButton>
		</Stack>
	);
	const rowProps = {
		as: "li",
		gap: 8,
		justify: "between",
		paddingX: 16,
		paddingY: 8,
		background: current ? "selected" : undefined,
		hover: !current,
	} as const;
	if (!actions || actions.length === 0) {
		return (
			<Inline {...rowProps}>
				{button}
				{trailing}
			</Inline>
		);
	}
	return (
		<ActionContextMenu actions={actions} trigger={<Inline {...rowProps} />}>
			{button}
			{trailing}
			<MoreActionsButton actions={actions} label={actionsLabel ?? title} />
		</ActionContextMenu>
	);
}
