"use client";

// design-system: drawing — the docked side panel: positioned beside the list, its width comes from a drag handle (a CSS variable)

import { useTranslator } from "@monti-cms/core/site";
import { Box, Heading, IconButton, Inline } from "@monti-cms/ui";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { commonMessages } from "../../lib/common.messages";
import { type PanelResizeConfig, PanelResizeHandle, usePanelResize } from "../../ui/panel-resize";

/** Width classes of the right slot on wide screens: `--panel-width` comes from `usePanelResize` (written literally so Tailwind can read it). */
export const SIDE_PANEL_WIDTH = "w-[22rem] max-w-full sm:w-[var(--panel-width)]";

/**
 * Place of the right slot opened beside the list (taxonomy edit, media detail). On narrow screens it covers the list,
 * on wide screens it sits beside the list at the width chosen with the drag handle on its left edge.
 */
const SIDE_PANEL_DOCK =
	"absolute inset-y-0 right-0 z-20 w-full shadow-monti-floating sm:w-[var(--panel-width)] lg:relative lg:shrink-0 lg:shadow-none";

/** The right slot beside a list, with a drag handle on its left edge. The panel inside fills it. */
export function DockedPanel({ resize, children }: { resize: PanelResizeConfig; children: ReactNode }) {
	const panel = usePanelResize(resize);
	return (
		<div className={SIDE_PANEL_DOCK} style={panel.style}>
			<PanelResizeHandle resize={panel} />
			{children}
		</div>
	);
}

/** Widths of the panels beside a list or an editor (px). Each kind remembers its own width. */
export const RECORD_PANEL_RESIZE: PanelResizeConfig = { name: "record", defaultWidth: 448, minWidth: 352 };
export const MEDIA_PANEL_RESIZE: PanelResizeConfig = { name: "media-detail", defaultWidth: 384, minWidth: 352 };
export const INSPECTOR_PANEL_RESIZE: PanelResizeConfig = { name: "inspector", defaultWidth: 384, minWidth: 352 };

/** Background of the item currently open in the list (open in the right slot or edit slot). */
export const OPEN_ITEM = "bg-monti-selected text-monti-default";

/** Right slot header. A title and a close button (the name is always "Close"). */
export function SidePanelHeader({
	title,
	onClose,
	children,
}: {
	title?: ReactNode;
	onClose: () => void;
	/** Content to put instead of (or next to) the title (tabs etc.). */
	children?: ReactNode;
}) {
	const t = useTranslator(commonMessages);
	return (
		<Inline gap="tight" shrink={false} border="bottom" paddingY="condensed" paddingX="comfortable">
			{title !== undefined && (
				<Box grow minWidth={0}>
					<Heading as="h2" variant="label" truncate>
						{title}
					</Heading>
				</Box>
			)}
			{children}
			<IconButton label={t("close")} side="bottom" onClick={onClose}>
				<X aria-hidden />
			</IconButton>
		</Inline>
	);
}
