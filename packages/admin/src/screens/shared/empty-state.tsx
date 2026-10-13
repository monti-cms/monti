import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/utils";
import { Button } from "../../ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "../../ui/empty";

export interface EmptyStateAction {
	label: string;
	onClick: () => void;
	icon?: LucideIcon;
}

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
	compact = false,
	className,
}: {
	icon?: LucideIcon;
	title: string;
	description?: string;
	action?: EmptyStateAction;
	compact?: boolean;
	className?: string;
}) {
	const ActionIcon = action?.icon;
	if (compact) {
		return (
			<Empty data-variant="compact" className={cn("flex-none gap-1 p-2", className)}>
				<EmptyHeader className="gap-0.5">
					<EmptyTitle className="font-normal text-cms-muted-foreground text-sm">{title}</EmptyTitle>
					{description && <EmptyDescription className="text-xs">{description}</EmptyDescription>}
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
			{action && (
				<EmptyContent>
					<Button type="button" size="sm" variant="outline" onClick={action.onClick}>
						{ActionIcon && <ActionIcon aria-hidden />}
						{action.label}
					</Button>
				</EmptyContent>
			)}
		</Empty>
	);
}
