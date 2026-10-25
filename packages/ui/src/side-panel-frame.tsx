"use client";

import { XIcon } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";
import { IconButton } from "./icon-button";
import { useUiLabels } from "./labels";
import { Heading, Text } from "./text";

/**
 * The inside of a panel beside a screen (an assistant, a notes list): a header row with the title, a short line under it and the panel's actions, a body that
 * scrolls, and an optional footer that stays at the bottom (a box to type in). It fills the pane it is put in (a `ResizablePane`, or a sheet on a narrow screen).
 * With `onClose` the header ends with a close button.
 */
export function SidePanelFrame({
	title,
	description,
	actions,
	onClose,
	footer,
	className,
	children,
	...props
}: Omit<ComponentProps<"section">, "title"> & {
	title: ReactNode;
	/** A muted line under the title (what the panel is using, where it is looking). */
	description?: ReactNode;
	/** Buttons at the end of the header, before the close button. */
	actions?: ReactNode;
	onClose?: () => void;
	/** Pinned under the body. */
	footer?: ReactNode;
}) {
	const labels = useUiLabels();
	return (
		<section data-slot="side-panel-frame" className={cn("flex min-h-0 min-w-0 flex-1 flex-col", className)} {...props}>
			<header
				data-slot="side-panel-frame-header"
				className="flex shrink-0 items-center gap-tight border-monti-muted border-b px-comfortable py-condensed"
			>
				<div className="flex min-w-0 flex-1 flex-col">
					<Heading as="h2" variant="label" truncate>
						{title}
					</Heading>
					{description && (
						<Text variant="caption" tone="muted" truncate>
							{description}
						</Text>
					)}
				</div>
				{actions}
				{onClose && (
					<IconButton label={labels.close} side="bottom" onClick={onClose}>
						<XIcon aria-hidden />
					</IconButton>
				)}
			</header>
			<div
				data-slot="side-panel-frame-body"
				className="flex min-h-0 flex-1 flex-col gap-comfortable overflow-y-auto p-comfortable"
			>
				{children}
			</div>
			{footer && (
				<footer data-slot="side-panel-frame-footer" className="shrink-0 border-monti-muted border-t p-comfortable">
					{footer}
				</footer>
			)}
		</section>
	);
}
