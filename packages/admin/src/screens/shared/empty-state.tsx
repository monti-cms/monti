import { Box, Empty, EmptyStep, Text } from "@monti-cms/ui";
import { AdminLink as Link } from "../../router";

export interface EmptyStateAction {
	label: string;
	onClick: () => void;
	disabled?: boolean;
}

/** A second way forward beside the action: a link to another screen, or a button. */
export type EmptyStateSecondaryAction = { label: string; href: string } | { label: string; onClick: () => void };

/**
 * The one empty look of the admin: a line that says so, one quiet line under it, and what can be done as steps (the action, then the second way).
 * The full form is for a list or grid that has nothing. The compact form, for a popup or a short list, is one quiet line of text with no box.
 */
export function EmptyState({
	title,
	description,
	action,
	secondaryAction,
	compact = false,
}: {
	title: string;
	description?: string;
	action?: EmptyStateAction;
	secondaryAction?: EmptyStateSecondaryAction;
	compact?: boolean;
}) {
	if (compact)
		return (
			<Box padding={12}>
				<Text as="p" variant="note" tone="subtle">
					{title}
				</Text>
			</Box>
		);
	return (
		<Empty title={title} description={description}>
			{action && (
				<EmptyStep disabled={action.disabled} onClick={action.onClick}>
					{action.label}
				</EmptyStep>
			)}
			{secondaryAction &&
				("href" in secondaryAction ? (
					<EmptyStep render={<Link role="link" href={secondaryAction.href} />}>{secondaryAction.label}</EmptyStep>
				) : (
					<EmptyStep onClick={secondaryAction.onClick}>{secondaryAction.label}</EmptyStep>
				))}
		</Empty>
	);
}
