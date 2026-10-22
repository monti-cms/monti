import {
	Button,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
	Inline,
	Stack,
	Text,
} from "@monti-cms/ui";
import { cn, Empty as OpenEmpty } from "@monti-cms/ui/internal";
import type { LucideIcon } from "lucide-react";
import { AdminLink as Link } from "../../router";

export interface EmptyStateAction {
	label: string;
	onClick: () => void;
	icon?: LucideIcon;
	/** `primary` for the one action that starts the screen's job. Default is the quiet outline look. */
	emphasis?: "primary";
	disabled?: boolean;
}

/** A second way forward beside the action: a link to another screen, or a button. */
export type EmptyStateSecondaryAction =
	| { label: string; href: string; icon?: LucideIcon }
	| { label: string; onClick: () => void; icon?: LucideIcon };

/**
 * The one empty look of the admin: an icon tile, a title, an optional one-line description and an optional action.
 * The full form fills the space of its list or grid and centers its content there, so every empty screen looks the same.
 * The compact form is for dialogs and popovers: just the text, without the tile.
 */
export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
	secondaryAction,
	compact = false,
	className,
}: {
	icon?: LucideIcon;
	title: string;
	description?: string;
	action?: EmptyStateAction;
	secondaryAction?: EmptyStateSecondaryAction;
	compact?: boolean;
	className?: string;
}) {
	const ActionIcon = action?.icon;
	const SecondaryIcon = secondaryAction?.icon;
	if (compact) {
		return (
			<Stack gap="tight" align="center" padding="condensed" data-variant="compact">
				<Stack gap="hair" align="center">
					<Text variant="label" tone="muted">
						{title}
					</Text>
					{description && (
						<Text variant="caption" tone="muted">
							{description}
						</Text>
					)}
				</Stack>
				{action && (
					<Button type="button" size="xs" variant="outline" onClick={action.onClick}>
						{ActionIcon && <ActionIcon aria-hidden />}
						{action.label}
					</Button>
				)}
			</Stack>
		);
	}
	return (
		// design-system: needs a min-height option on Empty (the full form fills its space, at least 16rem); className is kept for callers that size it
		<OpenEmpty data-variant="full" className={cn("min-h-64 flex-1", className)}>
			<EmptyHeader>
				{Icon && (
					<EmptyMedia variant="icon">
						<Icon aria-hidden />
					</EmptyMedia>
				)}
				<EmptyTitle>{title}</EmptyTitle>
				{description && <EmptyDescription>{description}</EmptyDescription>}
			</EmptyHeader>
			{(action || secondaryAction) && (
				<EmptyContent>
					<Inline justify="center" gap="condensed">
						{action && (
							<Button
								type="button"
								size="sm"
								variant={action.emphasis === "primary" ? "default" : "outline"}
								disabled={action.disabled}
								onClick={action.onClick}
							>
								{ActionIcon && <ActionIcon aria-hidden />}
								{action.label}
							</Button>
						)}
						{secondaryAction &&
							("href" in secondaryAction ? (
								<Button
									variant="outline"
									size="sm"
									nativeButton={false}
									render={<Link role="link" href={secondaryAction.href} />}
								>
									{SecondaryIcon && <SecondaryIcon aria-hidden />}
									{secondaryAction.label}
								</Button>
							) : (
								<Button type="button" size="sm" variant="outline" onClick={secondaryAction.onClick}>
									{SecondaryIcon && <SecondaryIcon aria-hidden />}
									{secondaryAction.label}
								</Button>
							))}
					</Inline>
				</EmptyContent>
			)}
		</OpenEmpty>
	);
}
