"use client";

import * as React from "react";
import { cn } from "./cn";
import { CutWords } from "./cut-words";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";
import { Folder, OverflowMenuHorizontal } from "./icons";

/** A folder on the way to the open one. */
type PagePathStep = { name: string; onOpen?: () => void };

/**
 * The page title as the way down to the open folder (the media library, 2026-11 redesign `media-empty.html`, `media-deep.html`): the folders above it
 * at the title's size in the faint tone, each a button back to it, a "/" between them, and the open folder in ink. It is the title of a `PageHeader`
 * (its `title`), so the way back sits in the title row and nothing under it moves. A long name of the open folder is cut at its end with "…" and says
 * itself whole when pointed at. With `hidden`, the folders between the first and the last `trail` step fold into a 32px ⋯ that opens them in a menu
 * (a deep folder: the first and the parent stay).
 */
function PagePath({
	trail,
	hidden,
	current,
	hiddenLabel,
	defaultOpen,
}: {
	/** The folders above the open one, from the top. */
	trail: readonly PagePathStep[];
	/** Folders folded between the first and the rest of `trail`, from the top. */
	hidden?: readonly PagePathStep[];
	/** The open folder. */
	current: string;
	/** The ⋯'s name for screen readers ("상위 폴더"). */
	hiddenLabel?: string;
	/** The ⋯'s menu is open at first (for a story). */
	defaultOpen?: boolean;
}) {
	const steps: React.ReactNode[] = trail.map((step) => (
		<button
			key={`step-${step.name}`}
			type="button"
			onClick={step.onOpen}
			className="shrink-0 cursor-pointer rounded-monti-sm border-0 bg-transparent p-0 text-monti-faint outline-none [font:inherit] hover:text-monti-default focus-visible:ring-2 focus-visible:ring-monti-contrast/60"
		>
			{step.name}
		</button>
	));
	if (hidden && hidden.length > 0)
		steps.splice(
			1,
			0,
			<DropdownMenu key="hidden" defaultOpen={defaultOpen}>
				<DropdownMenuTrigger
					aria-label={hiddenLabel}
					className="flex size-monti-control-md shrink-0 cursor-pointer items-center justify-center rounded-monti-md border-0 bg-transparent p-0 text-monti-faint outline-none hover:bg-monti-muted focus-visible:ring-2 focus-visible:ring-monti-contrast/60 data-popup-open:bg-monti-muted [&_svg]:size-4"
				>
					<OverflowMenuHorizontal aria-hidden />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="start" alignOffset={-15} sideOffset={8} className="w-[200px] min-w-0">
					{hidden.map((step) => (
						<DropdownMenuItem key={step.name} onClick={step.onOpen}>
							<Folder aria-hidden />
							{step.name}
						</DropdownMenuItem>
					))}
				</DropdownMenuContent>
			</DropdownMenu>,
		);
	return (
		<span data-slot="page-path" className="flex min-w-0 items-center">
			{steps.map((step, index) => (
				<React.Fragment key={index === 0 ? "first" : `at-${index}`}>
					{step}
					<span aria-hidden className={cn(SLASH)}>
						/
					</span>
				</React.Fragment>
			))}
			<CutWords aria-current="page" className="min-w-0 truncate">
				{current}
			</CutWords>
		</span>
	);
}

/** The "/" between two steps: 10px each side, thin, a step quieter than the steps. */
const SLASH = "shrink-0 px-[10px] font-normal text-monti-faint opacity-60";

export { PagePath, type PagePathStep };
