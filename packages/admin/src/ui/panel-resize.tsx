"use client";

import { useTranslator } from "@monti-cms/core/site";
// design-allow: the open ResizeHandle: the admin's panel resize glue, and no closed handle exists
import { ResizeHandle } from "@monti-cms/ui/internal";
import { type CSSProperties, useCallback, useEffect, useState } from "react";
import { positiveNumberCodec, usePreference } from "../lib/hooks/use-preference";
import { uiMessages } from "./messages";

/** Below this viewport width a panel covers the screen and cannot be resized. */
export const PANEL_RESIZE_MIN_VIEWPORT = 640;
/** The widest a panel gets, as a share of the viewport. */
const MAX_VIEWPORT_SHARE = 0.7;
/** Space always left to the page behind a panel. */
const VIEWPORT_MARGIN = 32;

export interface PanelResizeConfig {
	/** Kind of panel; the chosen width is remembered under this name for the site, in this browser. */
	readonly name: string;
	/** Width in px until the writer chooses one. */
	readonly defaultWidth: number;
	/** Narrowest width in px. */
	readonly minWidth: number;
}

export interface PanelResize {
	/** Current width in px (always within `min`..`max`). */
	readonly width: number;
	readonly min: number;
	readonly max: number;
	/** `false` on narrow screens, where the panel keeps its full width and has no handle. */
	readonly enabled: boolean;
	/** Sets the width of the panel; `persist` also remembers it. */
	readonly setWidth: (width: number, persist: boolean) => void;
	/** Back to the default width, and forgets the chosen one. */
	readonly reset: () => void;
	/** Put on the panel: its width as the CSS variable `--panel-width` (read with `sm:w-[var(--panel-width)]`). */
	readonly style: CSSProperties;
}

const storageName = (name: string) => `panel-width:${name}`;

/**
 * Width of a right-side panel that the writer can drag. Between `minWidth` and 70% of the viewport (never closer than a small margin to its edge),
 * remembered per panel kind in the site's browser preferences. Missing storage means the default width.
 */
export function usePanelResize({ name, defaultWidth, minWidth }: PanelResizeConfig): PanelResize {
	const [stored, setStored, forget] = usePreference(storageName(name), positiveNumberCodec, 0);
	// The width while the handle is dragged; it is remembered only when the drag ends.
	const [dragging, setDragging] = useState<number | null>(null);
	const [viewport, setViewport] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));

	useEffect(() => {
		const onResize = () => setViewport(window.innerWidth);
		onResize();
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	const max = Math.max(minWidth, Math.floor(Math.min(viewport * MAX_VIEWPORT_SHARE, viewport - VIEWPORT_MARGIN)));
	const clamp = useCallback((value: number) => Math.min(max, Math.max(minWidth, Math.round(value))), [max, minWidth]);
	const width = clamp(dragging ?? (stored || defaultWidth));

	const setWidth = useCallback(
		(next: number, persist: boolean) => {
			const value = clamp(next);
			if (persist) {
				setStored(value);
				setDragging(null);
			} else setDragging(value);
		},
		[clamp, setStored],
	);
	const reset = useCallback(() => {
		setDragging(null);
		forget();
	}, [forget]);

	return {
		width,
		min: minWidth,
		max,
		enabled: viewport >= PANEL_RESIZE_MIN_VIEWPORT,
		setWidth,
		reset,
		style: { "--panel-width": `${width}px` } as CSSProperties,
	};
}

/**
 * The drag handle on the left edge of a right-side panel (the parent must be positioned): the design system's {@link ResizeHandle}, driven by
 * `usePanelResize`. Left widens, Right narrows; Home and End go to the limits, double-click to the default width.
 */
export function PanelResizeHandle({ resize, className }: { resize: PanelResize; className?: string }) {
	const t = useTranslator(uiMessages);
	if (!resize.enabled) return null;
	return (
		<ResizeHandle
			edge="start"
			value={resize.width}
			min={resize.min}
			max={resize.max}
			label={t("panel.resize")}
			onChange={resize.setWidth}
			onReset={resize.reset}
			data-slot="panel-resize-handle"
			className={className}
		/>
	);
}
