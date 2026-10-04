"use client";

import { type PropsWithChildren, useId, useRef, useState } from "react";

/**
 * Tooltip (`:tooltip[text]{content="description"}`). Hovering or keyboard focus shows the description, and on touch it opens and closes with a tap.
 * Esc closes it. Even when hidden, the description is read by screen readers through `aria-describedby`. `note` is the annotation number of a tooltip inside code,
 * and the number is shown next to the text only on touch devices (CSS).
 */
export function Tooltip({ content, note, children }: PropsWithChildren<{ content?: string; note?: string | number }>) {
	const id = useId();
	const [open, setOpen] = useState(false);
	// Whether a touch press is in progress. A touch also moves focus, so toggle only once per press to avoid opening and immediately closing.
	const touching = useRef(false);

	return (
		<span
			className="cms-block-tooltip"
			data-open={open ? "" : undefined}
			onPointerEnter={(event) => event.pointerType === "mouse" && setOpen(true)}
			onPointerLeave={(event) => event.pointerType === "mouse" && setOpen(false)}
		>
			{/* biome-ignore lint/a11y/noStaticElementInteractions: inline text within a sentence, so a span receives mouse, touch, and focus instead of a button */}
			<span
				className="cms-block-tooltip-trigger"
				// biome-ignore lint/a11y/noNoninteractiveTabindex: takes focus so the description can also be opened with the keyboard
				tabIndex={0}
				aria-describedby={id}
				onPointerDown={(event) => {
					touching.current = event.pointerType !== "mouse";
				}}
				onClick={() => {
					if (!touching.current) return;
					touching.current = false;
					setOpen((current) => !current);
				}}
				onFocus={() => {
					if (!touching.current) setOpen(true);
				}}
				onBlur={() => {
					touching.current = false;
					setOpen(false);
				}}
				onKeyDown={(event) => {
					if (event.key === "Escape") setOpen(false);
				}}
			>
				{children}
				{note ? (
					<sup aria-hidden className="cms-block-tooltip-note">
						{note}
					</sup>
				) : null}
			</span>
			<span id={id} role="tooltip" className="cms-block-tooltip-content">
				{content}
			</span>
		</span>
	);
}
