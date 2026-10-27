import { Empty, EmptyStep } from "@monti-cms/ui";
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
 * The full form is for a list or grid that has nothing; the compact form is for dialogs and popovers.
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
	return (
		<Empty
			size={compact ? "compact" : "fill"}
			title={title}
			description={description}
			data-variant={compact ? "compact" : "full"}
		>
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
