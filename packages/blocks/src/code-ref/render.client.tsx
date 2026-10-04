"use client";

import { type PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import { findAnchorLines, focusLines, isOnScreen, revealLines } from "./dom";

/** How long (ms) the highlight stays after a press. */
const FOCUS_MS = 2500;

/**
 * Link between body text and code lines (`:code-ref[text]{to="c1"}`). Hovering or focusing the text highlights the linked code lines and
 * dims the other lines of the same code block (`pre[data-code-focus]`, `.line[data-focused]`, `@monti-cms/core/render.css`).
 * Pressing it, or pressing Enter or Space, scrolls to the line when the code is off screen (expanding collapsed areas) and keeps the highlight briefly.
 * If the linked line is not found (a deleted anchor), the text appears as unlinked text.
 */
export function CodeRef({ to, children }: PropsWithChildren<{ to: string }>) {
	const [broken, setBroken] = useState(false);
	const clearRef = useRef<(() => void) | null>(null);
	const timer = useRef<number | undefined>(undefined);

	useEffect(() => {
		setBroken(findAnchorLines(to).length === 0);
	}, [to]);

	const clear = useCallback(() => {
		window.clearTimeout(timer.current);
		clearRef.current?.();
		clearRef.current = null;
	}, []);

	useEffect(() => clear, [clear]);

	/** Highlights the linked lines. With `timed`, removes the highlight after a moment. Returns the lines if found. */
	const focus = useCallback(
		(timed: boolean) => {
			const lines = findAnchorLines(to);
			if (lines.length === 0) return lines;
			clear();
			clearRef.current = focusLines(lines);
			if (timed) timer.current = window.setTimeout(clear, FOCUS_MS);
			return lines;
		},
		[clear, to],
	);

	const activate = () => {
		const lines = findAnchorLines(to);
		if (lines.length === 0) return;
		if (!isOnScreen(lines)) revealLines(lines);
		focus(true);
	};

	if (broken) return <>{children}</>;

	return (
		// biome-ignore lint/a11y/useSemanticElements: inline text within a sentence, so the role goes on a span instead of a button
		<span
			role="button"
			tabIndex={0}
			className="cms-block-code-ref"
			data-code-ref={to}
			onPointerEnter={(event) => event.pointerType === "mouse" && focus(false)}
			onPointerLeave={(event) => event.pointerType === "mouse" && clear()}
			onFocus={() => focus(false)}
			onBlur={clear}
			onClick={activate}
			onKeyDown={(event) => {
				if (event.key !== "Enter" && event.key !== " ") return;
				event.preventDefault();
				activate();
			}}
		>
			{children}
		</span>
	);
}
