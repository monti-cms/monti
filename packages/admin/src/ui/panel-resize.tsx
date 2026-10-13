"use client";

import { useSite, useTranslator } from "@monti-cms/core/client";
import {
	type CSSProperties,
	type KeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { cn } from "../lib/utils/cn";
import { readPreference, writePreference } from "../lib/utils/site-storage";
import { uiMessages } from "./messages";

/** Below this viewport width a panel covers the screen and cannot be resized. */
export const PANEL_RESIZE_MIN_VIEWPORT = 640;
/** The widest a panel gets, as a share of the viewport. */
const MAX_VIEWPORT_SHARE = 0.7;
/** Space always left to the page behind a panel. */
const VIEWPORT_MARGIN = 32;
const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;

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
	const site = useSite();
	const [chosen, setChosen] = useState<number | null>(null);
	const [viewport, setViewport] = useState(() => (typeof window === "undefined" ? 1280 : window.innerWidth));

	useEffect(() => {
		const stored = Number(readPreference(site, storageName(name)));
		setChosen(Number.isFinite(stored) && stored > 0 ? stored : null);
	}, [site, name]);
	useEffect(() => {
		const onResize = () => setViewport(window.innerWidth);
		onResize();
		window.addEventListener("resize", onResize);
		return () => window.removeEventListener("resize", onResize);
	}, []);

	const max = Math.max(minWidth, Math.floor(Math.min(viewport * MAX_VIEWPORT_SHARE, viewport - VIEWPORT_MARGIN)));
	const clamp = useCallback((value: number) => Math.min(max, Math.max(minWidth, Math.round(value))), [max, minWidth]);
	const width = clamp(chosen ?? defaultWidth);

	const setWidth = useCallback(
		(next: number, persist: boolean) => {
			const value = clamp(next);
			setChosen(value);
			if (persist) writePreference(site, storageName(name), String(value));
		},
		[clamp, site, name],
	);
	const reset = useCallback(() => {
		setChosen(null);
		writePreference(site, storageName(name), "");
	}, [site, name]);

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
 * The drag handle on the left edge of a right-side panel (the parent must be positioned). A separator: drag it, or focus it and use the arrow keys
 * (Left widens, Right narrows, Shift for bigger steps, Home and End for the limits); double-click goes back to the default width.
 */
export function PanelResizeHandle({ resize, className }: { resize: PanelResize; className?: string }) {
	const t = useTranslator(uiMessages);
	const drag = useRef<{ startX: number; startWidth: number } | null>(null);
	if (!resize.enabled) return null;

	const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (event.button !== 0) return;
		drag.current = { startX: event.clientX, startWidth: resize.width };
		event.currentTarget.setPointerCapture?.(event.pointerId);
		event.preventDefault();
	};
	const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (!drag.current) return;
		// The panel is on the right: moving the edge left makes it wider.
		resize.setWidth(drag.current.startWidth + (drag.current.startX - event.clientX), false);
	};
	const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
		if (!drag.current) return;
		const { startX, startWidth } = drag.current;
		drag.current = null;
		event.currentTarget.releasePointerCapture?.(event.pointerId);
		resize.setWidth(startWidth + (startX - event.clientX), true);
	};
	const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
		const next =
			event.key === "ArrowLeft"
				? resize.width + step
				: event.key === "ArrowRight"
					? resize.width - step
					: event.key === "Home"
						? resize.min
						: event.key === "End"
							? resize.max
							: null;
		if (next === null) return;
		event.preventDefault();
		resize.setWidth(next, true);
	};

	return (
		<div
			role="separator"
			aria-orientation="vertical"
			aria-label={t("panel.resize")}
			aria-valuenow={resize.width}
			aria-valuemin={resize.min}
			aria-valuemax={resize.max}
			tabIndex={0}
			data-slot="panel-resize-handle"
			className={cn(
				"absolute inset-y-0 left-0 z-30 w-1.5 cursor-col-resize touch-none bg-transparent transition-colors hover:bg-cms-ring/40 focus-visible:bg-cms-ring/60 focus-visible:outline-none active:bg-cms-ring/60",
				className,
			)}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={onPointerEnd}
			onPointerCancel={onPointerEnd}
			onKeyDown={onKeyDown}
			onDoubleClick={resize.reset}
		/>
	);
}
