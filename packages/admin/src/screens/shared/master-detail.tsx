"use client";

import { Box, Inline, Skeleton, Stack, Text, TextLink } from "@monti-cms/ui";
import { Stack as OpenStack } from "@monti-cms/ui/internal";
import type { ReactNode } from "react";
import { ActionContextMenu, type MenuAction, MoreActionsButton } from "./action-menu";

/**
 * A list on the left and the open item's editor (or an empty state) on the right: the shape of the templates page and the AI tabs.
 * `list` is a {@link ListPane}; `children` is the right side, which scrolls on its own.
 */
export function MasterDetail({ list, children }: { list: ReactNode; children: ReactNode }) {
	return (
		<Inline align="stretch" gap="none" grow minHeight={0} overflow="hidden">
			{list}
			<Stack gap="none" grow minWidth={0} overflow="y">
				{children}
			</Stack>
		</Inline>
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
	/** @deprecated Kept for callers that still set a width; the pane has one width now. */
	className?: string;
	children?: ReactNode;
}) {
	const hasRows = Array.isArray(children) ? children.length > 0 : Boolean(children);
	return (
		// transitional: className kept for callers that have not moved yet (the open Stack merges it over the default width)
		<OpenStack gap="none" shrink={false} border="right" width="panel" className={className}>
			{header}
			<Stack as="ul" gap="none" grow minHeight={0} overflow="y" aria-label={label}>
				{loading
					? Array.from({ length: skeletonRows }, (_, index) => (
							// biome-ignore lint/suspicious/noArrayIndexKey: placeholder
							<Box as="li" key={index} padding="normal" aria-hidden>
								<Skeleton shape="control" />
							</Box>
						))
					: hasRows
						? children
						: empty && (
								<Stack as="li" grow align="center" justify="center" padding="comfortable">
									{empty}
								</Stack>
							)}
			</Stack>
		</OpenStack>
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
		<Stack gap="none" grow minWidth={0}>
			<TextLink
				underline="hover"
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
				<Stack gap="hair">
					<Inline gap="condensed" justify="between">
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
			</TextLink>
		</Stack>
	);
	// design-system: needs a hover surface on Box/Stack (the row's hover background)
	const rowProps = {
		as: "li",
		gap: "condensed",
		justify: "between",
		paddingX: "comfortable",
		paddingY: "condensed",
		background: current ? "selected" : undefined,
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
