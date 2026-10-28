"use client";

import { Close } from "@carbon/icons-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "./cn";
import { IconButton } from "./icon-button";
import { useUiLabels } from "./labels";

/**
 * The look of a tool panel, shared by `SidePanelFrame` and `Sheet`: a cream ground, a 60px head (title 16px bold at the start, icon buttons at the end, 24px
 * in and 12 out), a body with 20px above and 24 at the sides, and a foot that holds the one pill.
 */
export const PANEL_HEAD =
	"flex h-monti-header shrink-0 items-center gap-monti-4 border-monti-default border-b pr-monti-12 pl-monti-24";
export const PANEL_TITLE = "min-w-0 grow truncate font-bold text-monti-default text-monti-title";
export const PANEL_BODY = "flex flex-col gap-[18px] px-monti-24 py-monti-20";
export const PANEL_FOOT =
	"flex shrink-0 items-center justify-end gap-[18px] border-monti-default border-t px-monti-24 py-[14px]";

/**
 * The inside of a panel beside a screen (an assistant, a notes list): a 60px head with the title and the panel's actions, a body that scrolls, and
 * an optional foot that stays at the bottom (a box to type in, a save pill). The panel's ground is cream with a line down its left edge. It fills the
 * pane it is put in (a `ResizablePane`, or a sheet on a narrow screen). With `onClose` the head ends with a close button.
 */
export function SidePanelFrame({
	title,
	actions,
	onClose,
	footer,
	className,
	children,
	...props
}: Omit<ComponentProps<"section">, "title"> & {
	title: ReactNode;
	/** Icon buttons at the end of the head, before the close button. */
	actions?: ReactNode;
	onClose?: () => void;
	/** Pinned under the body. */
	footer?: ReactNode;
}) {
	const labels = useUiLabels();
	return (
		<section
			data-slot="side-panel-frame"
			className={cn(
				"flex min-h-0 min-w-0 flex-1 flex-col bg-monti-tool shadow-[inset_1px_0_0_var(--monti-border-default)]",
				className,
			)}
			{...props}
		>
			<header data-slot="side-panel-frame-header" className={PANEL_HEAD}>
				<h2 className={PANEL_TITLE}>{title}</h2>
				{actions}
				{onClose && (
					<IconButton label={labels.close} side="bottom" onClick={onClose}>
						<Close aria-hidden />
					</IconButton>
				)}
			</header>
			<div data-slot="side-panel-frame-body" className={cn(PANEL_BODY, "min-h-0 flex-1 overflow-y-auto")}>
				{children}
			</div>
			{footer && (
				<footer data-slot="side-panel-frame-footer" className={PANEL_FOOT}>
					{footer}
				</footer>
			)}
		</section>
	);
}
