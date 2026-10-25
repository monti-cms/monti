import type * as React from "react";
import { cn } from "./cn";

/**
 * A card you pick from a grid (a file in the media library, an image to insert): a preview on top, a name and a detail under it, a selected
 * look, and corner slots for a badge (`badge`, top left) and an action (`action`, top right, shown on hover and when selected or focused).
 */
function Tile({
	preview,
	title,
	detail,
	badge,
	action,
	selected = false,
	dimmed = false,
	className,
	...props
}: Omit<React.ComponentProps<"button">, "title"> & {
	preview: React.ReactNode;
	title: React.ReactNode;
	detail?: React.ReactNode;
	badge?: React.ReactNode;
	action?: React.ReactNode;
	selected?: boolean;
	dimmed?: boolean;
}) {
	return (
		<div
			data-slot="tile"
			data-selected={selected || undefined}
			className={cn("group/tile relative min-w-0", dimmed && "opacity-50", className)}
		>
			<button
				type="button"
				aria-pressed={selected}
				className="flex w-full flex-col overflow-hidden rounded-lg border border-monti-muted bg-monti-surface text-left shadow-monti-card outline-none transition-[border-color,box-shadow] hover:border-monti-emphasis focus-visible:ring-3 focus-visible:ring-monti-focus-soft group-data-selected/tile:border-monti-focus group-data-selected/tile:ring-2 group-data-selected/tile:ring-monti-focus-soft"
				{...props}
			>
				<span className="block border-monti-muted border-b">{preview}</span>
				<span className="flex min-w-0 flex-col gap-hair px-condensed py-condensed">
					<span className="truncate text-monti-label">{title}</span>
					{detail && <span className="truncate text-monti-caption text-monti-muted">{detail}</span>}
				</span>
			</button>
			{badge && <span className="pointer-events-none absolute top-condensed left-condensed">{badge}</span>}
			{action && (
				<span className="absolute top-condensed right-condensed opacity-0 transition-opacity focus-within:opacity-100 group-hover/tile:opacity-100 group-data-selected/tile:opacity-100">
					{action}
				</span>
			)}
		</div>
	);
}

/**
 * A choice in a list of options, as a row: an icon, a title and a hint, with a selected look (a field kind, an export scope). Renders a
 * button by default; inside a radio group it takes the radio's role from `render`.
 */
function ChoiceCard({
	icon,
	title,
	hint,
	selected = false,
	className,
	...props
}: Omit<React.ComponentProps<"button">, "title"> & {
	icon?: React.ReactNode;
	title: React.ReactNode;
	hint?: React.ReactNode;
	selected?: boolean;
}) {
	return (
		<button
			type="button"
			data-slot="choice-card"
			data-selected={selected || undefined}
			aria-pressed={selected}
			className={cn(
				"flex w-full items-start gap-normal rounded-md border border-monti-muted bg-monti-surface px-normal py-condensed text-left shadow-monti-card outline-none transition-[background-color,border-color,box-shadow] hover:border-monti-default hover:bg-monti-hover focus-visible:ring-3 focus-visible:ring-monti-focus-soft disabled:pointer-events-none disabled:opacity-50 data-selected:border-monti-focus data-selected:bg-monti-accent-muted",
				className,
			)}
			{...props}
		>
			{icon && <span className="mt-hair text-monti-muted [&_svg]:size-icon">{icon}</span>}
			<span className="flex min-w-0 flex-col gap-hair">
				<span className="text-monti-label">{title}</span>
				{hint && <span className="text-monti-caption text-monti-muted">{hint}</span>}
			</span>
		</button>
	);
}

export { ChoiceCard, Tile };
