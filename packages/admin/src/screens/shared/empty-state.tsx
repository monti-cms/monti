import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { AdminLink as Link } from "../../router";
import { Button, buttonVariants } from "../../ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../ui/empty";

export interface EmptyStateAction {
	label: string;
	onClick: () => void;
	icon?: LucideIcon;
	/** `primary` for the one action that starts the screen's job. Default is the quiet outline look. */
	emphasis?: "primary";
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
			<Empty data-variant="compact" className={cn("flex-none gap-1 p-2", className)}>
				<EmptyHeader className="gap-0.5">
					<EmptyTitle className="font-normal text-monti-label text-monti-muted-foreground">{title}</EmptyTitle>
					{description && <EmptyDescription className="text-monti-caption">{description}</EmptyDescription>}
				</EmptyHeader>
				{action && (
					<Button type="button" size="xs" variant="outline" onClick={action.onClick}>
						{ActionIcon && <ActionIcon aria-hidden />}
						{action.label}
					</Button>
				)}
			</Empty>
		);
	}
	return (
		<Empty data-variant="full" className={cn("min-h-64 flex-1", className)}>
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
				<EmptyContent className="flex-row justify-center">
					{action && (
						<Button
							type="button"
							size="sm"
							variant={action.emphasis === "primary" ? "default" : "outline"}
							onClick={action.onClick}
						>
							{ActionIcon && <ActionIcon aria-hidden />}
							{action.label}
						</Button>
					)}
					{secondaryAction &&
						("href" in secondaryAction ? (
							<Link href={secondaryAction.href} className={buttonVariants({ variant: "outline", size: "sm" })}>
								{SecondaryIcon && <SecondaryIcon aria-hidden />}
								{secondaryAction.label}
							</Link>
						) : (
							<Button type="button" size="sm" variant="outline" onClick={secondaryAction.onClick}>
								{SecondaryIcon && <SecondaryIcon aria-hidden />}
								{secondaryAction.label}
							</Button>
						))}
				</EmptyContent>
			)}
		</Empty>
	);
}
