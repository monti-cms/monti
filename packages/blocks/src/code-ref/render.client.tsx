"use client";

import { type PropsWithChildren, useCallback, useEffect, useId, useRef, useState } from "react";
import {
	addBackLink,
	type CodePreview,
	findAnchorLines,
	findRefTexts,
	focusLines,
	isOnScreen,
	previewLines,
	revealLines,
	revealRefText,
} from "./dom";

/** How long (ms) the highlight stays after a press. */
const FOCUS_MS = 2500;

/** The most code lines the hover preview shows. A longer range ends with an ellipsis line. */
const PREVIEW_MAX_LINES = 8;

/** Fixed text of the public component. The site language picks it in `render.tsx` (`messages.ts`). */
export interface CodeRefLabels {
	/** Accessible label of the back-link button on the code line (code to text). */
	readonly back: string;
}

const DEFAULT_LABELS: CodeRefLabels = { back: "Go to the text that links here" };

/**
 * Link between body text and code lines (`:code-ref[text]{to="c1"}`). Hovering or focusing the text highlights the linked code lines and
 * dims the other lines of the same code block (`pre[data-code-focus]`, `.line[data-focused]`, `@monti-cms/core/render.css`).
 * Pressing it, or pressing Enter or Space, scrolls to the line when the code is off screen (expanding collapsed areas) and keeps the highlight briefly.
 * While the linked lines are off screen, hovering or focusing also shows a small preview of them next to the text (`role="tooltip"`, hidden on leave, blur, or Esc).
 * The first text that points to a label adds a back-link button to the end of the first linked line, which scrolls back to that text (`data-focused`).
 * A link resolves to exactly one code block (the first one that has the label). If the linked line is not found (a deleted anchor), the text appears as unlinked text.
 */
export function CodeRef({
	to,
	labels = DEFAULT_LABELS,
	children,
}: PropsWithChildren<{ to: string; labels?: CodeRefLabels }>) {
	const [broken, setBroken] = useState(false);
	const [preview, setPreview] = useState<CodePreview | null>(null);
	const previewId = useId();
	const textRef = useRef<HTMLSpanElement>(null);
	const clearRef = useRef<(() => void) | null>(null);
	const timer = useRef<number | undefined>(undefined);

	useEffect(() => {
		setBroken(findAnchorLines(to).length === 0);
	}, [to]);

	// The first text that points to the label (document order) owns the back-link button, so the label gets one button however many texts point to it.
	const backLabel = labels.back;
	useEffect(() => {
		const text = textRef.current;
		if (!text || findRefTexts(to)[0] !== text) return;
		return addBackLink(findAnchorLines(to), () => revealRefText(to, FOCUS_MS), backLabel);
	}, [to, backLabel]);

	const clear = useCallback(() => {
		window.clearTimeout(timer.current);
		clearRef.current?.();
		clearRef.current = null;
		setPreview(null);
	}, []);

	// Esc hides the preview wherever the focus is (the pointer can be over the text without focusing it).
	const shown = preview !== null;
	useEffect(() => {
		if (!shown) return;
		const onKeyDown = (event: KeyboardEvent) => event.key === "Escape" && setPreview(null);
		document.addEventListener("keydown", onKeyDown);
		return () => document.removeEventListener("keydown", onKeyDown);
	}, [shown]);

	useEffect(() => clear, [clear]);

	/** Highlights the linked lines. With `timed`, removes the highlight after a moment. Returns the lines if found. */
	const focus = useCallback(
		(timed: boolean) => {
			const lines = findAnchorLines(to);
			if (lines.length === 0) return lines;
			clear();
			clearRef.current = focusLines(lines);
			if (timed) timer.current = window.setTimeout(clear, FOCUS_MS);
			// Linked lines that are not on screen cannot be seen in place, so show them next to the text. Pressing scrolls to them instead.
			else if (!isOnScreen(lines)) setPreview(previewLines(lines, PREVIEW_MAX_LINES));
			return lines;
		},
		[clear, to],
	);

	const activate = () => {
		const lines = findAnchorLines(to);
		if (lines.length === 0) return;
		if (!isOnScreen(lines)) revealLines(lines);
		// `focus` clears first, which also hides the preview.
		focus(true);
	};

	if (broken) return <>{children}</>;

	return (
		<span className="cms-block-code-ref-wrap">
			{/* biome-ignore lint/a11y/useSemanticElements: inline text within a sentence, so the role goes on a span instead of a button */}
			<span
				ref={textRef}
				role="button"
				tabIndex={0}
				className="cms-block-code-ref"
				data-code-ref={to}
				aria-describedby={preview ? previewId : undefined}
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
			{preview ? (
				<span id={previewId} role="tooltip" className="cms-block-code-ref-preview">
					{preview.title ? <span className="cms-block-code-ref-preview-title">{preview.title}</span> : null}
					{preview.lines.map((line, index) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: the line number is the identity
						<span key={index} className="cms-block-code-ref-preview-line">
							{line || " "}
						</span>
					))}
					{preview.truncated ? <span className="cms-block-code-ref-preview-line">…</span> : null}
				</span>
			) : null}
		</span>
	);
}
