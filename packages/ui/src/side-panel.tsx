"use client";

import { Close } from "@carbon/icons-react";
import { type ComponentProps, type FormEventHandler, type ReactNode, useId } from "react";
import { cn } from "./cn";
import { IconButton } from "./icon-button";
import { useUiLabels } from "./labels";

/**
 * The look of a tool panel, shared by `SidePanel` and `Sheet`: a cream ground, a 60px head (title 16px bold at the start, icon buttons at the end, 24px
 * in and 12 out), a body with 20px above and 24 at the sides, and a foot that holds the one pill.
 */
export const PANEL_HEAD =
	"flex h-monti-header shrink-0 items-center gap-monti-4 border-monti-default border-b pr-monti-12 pl-monti-24";
export const PANEL_TITLE = "min-w-0 grow truncate font-bold text-monti-default text-monti-title";
export const PANEL_BODY = "flex flex-col gap-[18px] px-monti-24 py-monti-20";
export const PANEL_FOOT =
	"flex shrink-0 items-center justify-end gap-[18px] border-monti-default border-t px-monti-24 py-[14px]";

/** The widths a side panel takes: `side` for a file or an activity beside a list, `panel` for the entry's properties, `assistant` for the assistant. */
const SIDE_PANEL_WIDTH = {
	side: "sm:w-monti-side-panel",
	panel: "sm:w-monti-panel",
	assistant: "sm:w-monti-assistant",
} as const;

/**
 * A panel beside a screen, for what is looked at together with it (a media file, an activity, an entry's properties, the assistant): it does not
 * cover the screen. A fixed width by `width`, a cream ground, a line down its left edge, and a 60px head with the title (16px bold), the panel's
 * icon buttons and the close button. Under the body an optional foot holds the one pill, or the box to type in. Docked at the window's right edge,
 * it covers the ✦ button of the page's corner. The panel is named by its title. Put it in a row beside the screen; on a narrow screen it takes the whole width. With `onSubmit` the body and the foot are one form, so Enter
 * in a field and the foot's submit button save it.
 */
export function SidePanel({
	title,
	actions,
	onClose,
	footer,
	width = "side",
	bleed = false,
	onSubmit,
	className,
	children,
	...props
}: Omit<ComponentProps<"aside">, "title"> & {
	title: ReactNode;
	/** Icon buttons at the end of the head, before the close button. */
	actions?: ReactNode;
	onClose?: () => void;
	/** Pinned under the body. */
	footer?: ReactNode;
	width?: keyof typeof SIDE_PANEL_WIDTH;
	/** The body keeps no padding or gap of its own: for content that lays out its own sections edge to edge (tabs, bands). */
	bleed?: boolean;
	onSubmit?: FormEventHandler<HTMLFormElement>;
}) {
	const labels = useUiLabels();
	const titleId = useId();
	const body = (
		<div
			data-slot="side-panel-body"
			className={cn(bleed ? "flex flex-col" : PANEL_BODY, "min-h-0 flex-1 overflow-y-auto")}
		>
			{children}
		</div>
	);
	const foot = footer && (
		<footer data-slot="side-panel-footer" className={PANEL_FOOT}>
			{footer}
		</footer>
	);
	return (
		<aside
			data-slot="side-panel"
			aria-labelledby={titleId}
			className={cn(
				"flex min-h-0 w-full min-w-0 shrink-0 flex-col bg-monti-tool shadow-[inset_1px_0_0_var(--monti-border-default)]",
				SIDE_PANEL_WIDTH[width],
				className,
			)}
			{...props}
		>
			<header data-slot="side-panel-header" className={PANEL_HEAD}>
				<h2 id={titleId} className={PANEL_TITLE}>
					{title}
				</h2>
				{actions}
				{onClose && (
					<IconButton label={labels.close} side="bottom" onClick={onClose}>
						<Close aria-hidden />
					</IconButton>
				)}
			</header>
			{onSubmit ? (
				<form className="flex min-h-0 flex-1 flex-col" onSubmit={onSubmit}>
					{body}
					{foot}
				</form>
			) : (
				<>
					{body}
					{foot}
				</>
			)}
		</aside>
	);
}
