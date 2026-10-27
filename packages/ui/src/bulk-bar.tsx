"use client";

import { MoreHorizontal } from "lucide-react";
import type * as React from "react";
import { cn } from "./cn";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./dropdown-menu";
import { PageToolbar, type SelectAll, ToolbarDivider } from "./page-header";
import { Spark } from "./spark";
import { TextButton } from "./text-button";

/**
 * What replaces a list's filter row once rows are picked: how many, the assistant's request on them, the two actions used most (as `children`,
 * text buttons), a ⋯ with the rest (the dangerous one last, in red), and at the end the way to let go. The select-all stays where it was.
 */
function BulkBar({
	label,
	request,
	more,
	selectAll,
	clearLabel,
	onClear,
	children,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "children"> & {
	/** How many are picked ("3 selected"). */
	label: string;
	/** Asks the assistant to work on the picked rows: a spark and its label. */
	request?: { label: string; onClick: () => void };
	/** The less frequent actions: `label` names the ⋯ for screen readers, `children` are the menu's rows. */
	more?: { label: string; children: React.ReactNode };
	selectAll?: SelectAll;
	/** The text of the button that clears the pick. */
	clearLabel: string;
	onClear: () => void;
	/** The two actions used most. */
	children?: React.ReactNode;
}) {
	return (
		<PageToolbar
			inset
			role="toolbar"
			aria-label={label}
			selectAll={selectAll}
			className={cn("text-monti-body", className)}
			{...props}
		>
			<span className="font-bold text-monti-default">{label}</span>
			{request && (
				<>
					<ToolbarDivider />
					<TextButton onClick={request.onClick} className="inline-flex items-center gap-monti-4 text-monti-proposal">
						<Spark className="size-monti-icon-xs" />
						{request.label}
					</TextButton>
				</>
			)}
			{(children || more) && <ToolbarDivider />}
			{children}
			{more && (
				<DropdownMenu>
					<DropdownMenuTrigger
						aria-label={more.label}
						className="flex size-6 cursor-pointer items-center justify-center rounded-monti-full border-0 bg-transparent p-0 text-monti-muted outline-none hover:bg-monti-selected focus-visible:ring-2 focus-visible:ring-monti-contrast/20 aria-expanded:bg-monti-selected"
					>
						<MoreHorizontal aria-hidden className="size-4" />
					</DropdownMenuTrigger>
					<DropdownMenuContent align="start">{more.children}</DropdownMenuContent>
				</DropdownMenu>
			)}
			<TextButton onClick={onClear} className="ml-auto text-monti-subtle">
				{clearLabel}
			</TextButton>
		</PageToolbar>
	);
}

export { BulkBar };
