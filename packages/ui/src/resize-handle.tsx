"use client";

import * as React from "react";
import { cn } from "./cn";
import { useUiLabels } from "./labels";

const KEY_STEP = 16;
const KEY_STEP_LARGE = 64;
const STORAGE_PREFIX = "monti-ui:width:";

const clampWidth = (value: number, min: number, max: number) => Math.min(max, Math.max(min, Math.round(value)));

function readStored(key: string): number | undefined {
	try {
		const value = Number(window.localStorage.getItem(STORAGE_PREFIX + key));
		return Number.isFinite(value) && value > 0 ? value : undefined;
	} catch {
		return undefined;
	}
}

function writeStored(key: string, value: number | null) {
	try {
		if (value === null) window.localStorage.removeItem(STORAGE_PREFIX + key);
		else window.localStorage.setItem(STORAGE_PREFIX + key, String(value));
	} catch {
		// Storage can be blocked or full; the width then lasts until the page is closed.
	}
}

/**
 * A width the person can change, between `min` and `max` px and remembered in this browser under `storageKey`. It starts at `defaultWidth` (also on the
 * server) and takes the remembered width right after mount. `setWidth(next, true)` remembers it; `setWidth(next, false)` is for a drag in progress.
 * `settled` turns true once the remembered width is in, so a width transition does not play on load.
 */
export function useResizableWidth({
	storageKey,
	defaultWidth,
	min,
	max,
}: {
	storageKey: string;
	defaultWidth: number;
	min: number;
	max: number;
}) {
	const [stored, setStored] = React.useState<number | null>(null);
	const [dragging, setDragging] = React.useState(false);
	const [settled, setSettled] = React.useState(false);

	React.useEffect(() => {
		setStored(readStored(storageKey) ?? null);
		const frame = requestAnimationFrame(() => setSettled(true));
		return () => cancelAnimationFrame(frame);
	}, [storageKey]);

	const width = clampWidth(stored ?? defaultWidth, min, max);
	const setWidth = React.useCallback(
		(next: number, commit: boolean) => {
			const value = clampWidth(next, min, max);
			setStored(value);
			setDragging(!commit);
			if (commit) writeStored(storageKey, value);
		},
		[min, max, storageKey],
	);
	const reset = React.useCallback(() => {
		setStored(null);
		setDragging(false);
		writeStored(storageKey, null);
	}, [storageKey]);

	return { width, min, max, setWidth, reset, resizing: dragging, settled };
}

type ResizeEdge = "start" | "end";

/**
 * The drag handle on the edge of a pane (the pane must be `relative`). A vertical separator: invisible until it is pointed at, dragged or focused,
 * then a 1px accent line inside a 8px hit area centered on the edge. Drag it, or focus it and use the arrow keys (the arrow toward the open side widens,
 * Shift for bigger steps, Home and End for the limits); double-click goes back to the default. `edge` is the side of the pane it sits on.
 */
function ResizeHandle({
	value,
	min,
	max,
	onChange,
	onReset,
	label,
	edge = "end",
	resizing = false,
	className,
	...props
}: Omit<React.ComponentProps<"div">, "onChange"> & {
	value: number;
	min: number;
	max: number;
	/** Called with the new width; `commit` is false while the pointer is still down. */
	onChange: (value: number, commit: boolean) => void;
	onReset: () => void;
	/** Screen reader name; "Resize" by default. */
	label?: string;
	edge?: ResizeEdge;
	resizing?: boolean;
}) {
	const labels = useUiLabels();
	const drag = React.useRef<{ startX: number; startValue: number } | null>(null);
	// Dragging toward the open side widens the pane: right for an `end` edge, left for a `start` edge.
	const sign = edge === "end" ? 1 : -1;

	const dragged = (event: React.PointerEvent) =>
		drag.current ? drag.current.startValue + sign * (event.clientX - drag.current.startX) : value;

	return (
		<div
			role="separator"
			aria-orientation="vertical"
			aria-label={label ?? labels.resize}
			aria-valuenow={value}
			aria-valuemin={min}
			aria-valuemax={max}
			tabIndex={0}
			data-slot="resize-handle"
			data-resizing={resizing ? "" : undefined}
			className={cn(
				"group/resize absolute inset-y-0 z-20 w-2 cursor-col-resize touch-none outline-none",
				edge === "end" ? "right-0 translate-x-1/2" : "left-0 -translate-x-1/2",
				className,
			)}
			onPointerDown={(event) => {
				if (event.button !== 0) return;
				drag.current = { startX: event.clientX, startValue: value };
				event.currentTarget.setPointerCapture?.(event.pointerId);
				event.preventDefault();
			}}
			onPointerMove={(event) => {
				if (drag.current) onChange(dragged(event), false);
			}}
			onPointerUp={(event) => {
				if (!drag.current) return;
				const next = dragged(event);
				drag.current = null;
				event.currentTarget.releasePointerCapture?.(event.pointerId);
				onChange(next, true);
			}}
			onPointerCancel={() => {
				if (!drag.current) return;
				const { startValue } = drag.current;
				drag.current = null;
				onChange(startValue, true);
			}}
			onDoubleClick={onReset}
			onKeyDown={(event) => {
				const step = event.shiftKey ? KEY_STEP_LARGE : KEY_STEP;
				const widen = edge === "end" ? "ArrowRight" : "ArrowLeft";
				const narrow = edge === "end" ? "ArrowLeft" : "ArrowRight";
				const next =
					event.key === widen
						? value + step
						: event.key === narrow
							? value - step
							: event.key === "Home"
								? min
								: event.key === "End"
									? max
									: null;
				if (next === null) return;
				event.preventDefault();
				onChange(next, true);
			}}
			{...props}
		>
			<span
				aria-hidden
				className={cn(
					"absolute inset-y-0 w-px bg-transparent transition-colors motion-reduce:transition-none",
					// Drawn over the pane's own 1px border (the handle is centered on the inside of that border).
					edge === "end" ? "left-1" : "left-0.75",
					"group-hover/resize:bg-monti-accent-emphasis group-focus-visible/resize:bg-monti-accent-emphasis group-data-resizing/resize:bg-monti-accent-emphasis",
				)}
			/>
		</div>
	);
}

/**
 * A column whose width the person can change, with its handle on one edge and a hairline on the other side of the handle. `resizeKey` names it for the
 * remembered width; the same key in two places shares one width. Defaults to the handle on the right edge (a list beside its detail).
 */
function ResizablePane({
	resizeKey,
	defaultWidth,
	min,
	max,
	label,
	edge = "end",
	className,
	children,
	...props
}: Omit<React.ComponentProps<"div">, "style"> & {
	resizeKey: string;
	defaultWidth: number;
	min: number;
	max: number;
	label?: string;
	edge?: ResizeEdge;
}) {
	const resize = useResizableWidth({ storageKey: resizeKey, defaultWidth, min, max });
	return (
		<div
			data-slot="resizable-pane"
			className={cn(
				"relative flex min-h-0 shrink-0 flex-col",
				edge === "end" ? "border-monti-muted border-r" : "border-monti-muted border-l",
				className,
			)}
			style={{ width: resize.width }}
			{...props}
		>
			{children}
			<ResizeHandle
				value={resize.width}
				min={min}
				max={max}
				onChange={resize.setWidth}
				onReset={resize.reset}
				label={label}
				edge={edge}
				resizing={resize.resizing}
			/>
		</div>
	);
}

export { ResizablePane, ResizeHandle, type ResizeEdge };
