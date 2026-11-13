import type { Editor } from "@tiptap/react";
import { useEffect, useState } from "react";
import { blocksInBox, pickedBlocks, setPick } from "./block-pick";

/** The box being drawn, in viewport px. */
export type Box = { top: number; left: number; width: number; height: number };

/** The mouse moves this far (px) before a press in the margin becomes a box: a press alone does nothing. */
const START_AFTER = 4;
/** How far under the text's last block a box may still start: the room below the body where Notion starts one too. */
const BELOW = 64;
/** Near the top or bottom of the scrolling area (px) the box scrolls it, faster the closer it is. */
const EDGE = 48;
const MOST = 18;

/** What a press in the margin must not be taken from: something pressable or typed in, or the editor's own text. */
const OWN = "button, a, input, textarea, select, label, [role], [contenteditable], [data-slot=editor-margin]";

/** The nearest scrolling box around the text (the document when there is none). */
function scrollerOf(element: HTMLElement): HTMLElement {
	for (let current = element.parentElement; current; current = current.parentElement) {
		const { overflowY } = getComputedStyle(current);
		if ((overflowY === "auto" || overflowY === "scroll") && current.scrollHeight > current.clientHeight) return current;
	}
	return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

/**
 * Picking blocks with a box (editor-tools.md, picking several blocks, T80): a press in the margin outside the text, beside the body, and a drag draws a
 * thin box; every block it touches from top to bottom is picked as it goes. Near the screen's edge it scrolls. A press without a drag picks nothing
 * and lets a pick go.
 */
export function useMarquee(editor: Editor | null) {
	const [box, setBox] = useState<Box | null>(null);

	useEffect(() => {
		if (!editor) return;
		const down = (event: MouseEvent) => {
			if (event.button !== 0 || !editor.isEditable || editor.isDestroyed) return;
			const { view } = editor;
			const target = event.target instanceof Element ? event.target : null;
			if (!target || view.dom.contains(target) || target.closest(OWN)) return;
			const body = view.dom.getBoundingClientRect();
			// Beside the text, from its top to a little under its end; within the area that scrolls with it (not a panel next to it).
			if (event.clientX >= body.left && event.clientX <= body.right) return;
			if (event.clientY < body.top || event.clientY > body.bottom + BELOW) return;
			const scroller = scrollerOf(view.dom);
			const isDocument = scroller === document.scrollingElement || scroller === document.documentElement;
			if (!isDocument && !scroller.contains(target)) return;
			event.preventDefault();
			if (pickedBlocks(view.state)) view.dispatch(setPick(view.state.tr, null));

			const startScroll = scroller.scrollTop;
			const startX = event.clientX;
			const startY = event.clientY;
			let x = startX;
			let y = startY;
			let drawing = false;
			let frame = 0;

			const draw = () => {
				// The start stays on the page where it was pressed, however far the area has scrolled since.
				const anchorY = startY - (scroller.scrollTop - startScroll);
				const top = Math.min(anchorY, y);
				const bottom = Math.max(anchorY, y);
				setBox({ top, left: Math.min(startX, x), width: Math.abs(x - startX), height: bottom - top });
				const blocks = blocksInBox(view, top, bottom);
				const now = pickedBlocks(view.state) ?? [];
				if (blocks.join() !== now.join())
					view.dispatch(setPick(view.state.tr, blocks.length > 0 ? blocks : null).setMeta("addToHistory", false));
			};
			const scroll = () => {
				const area = isDocument ? { top: 0, bottom: window.innerHeight } : scroller.getBoundingClientRect();
				const speed =
					y < area.top + EDGE
						? -Math.ceil(((area.top + EDGE - y) / EDGE) * MOST)
						: y > area.bottom - EDGE
							? Math.ceil(((y - (area.bottom - EDGE)) / EDGE) * MOST)
							: 0;
				if (speed !== 0) {
					const before = scroller.scrollTop;
					scroller.scrollTop += speed;
					if (scroller.scrollTop !== before) draw();
				}
				frame = requestAnimationFrame(scroll);
			};
			const move = (moved: MouseEvent) => {
				x = moved.clientX;
				y = moved.clientY;
				if (!drawing && Math.hypot(x - startX, y - startY) < START_AFTER) return;
				if (!drawing) {
					drawing = true;
					frame = requestAnimationFrame(scroll);
				}
				draw();
			};
			const up = () => {
				window.removeEventListener("mousemove", move);
				window.removeEventListener("mouseup", up);
				cancelAnimationFrame(frame);
				setBox(null);
				if (!drawing) return;
				// The click the mouse's release makes is not a press under the text (which would put the caret at the end).
				const swallow = (click: MouseEvent) => {
					click.stopPropagation();
					click.preventDefault();
				};
				window.addEventListener("click", swallow, { capture: true, once: true });
				setTimeout(() => window.removeEventListener("click", swallow, { capture: true }), 0);
				if (pickedBlocks(view.state)) view.focus();
			};
			window.addEventListener("mousemove", move);
			window.addEventListener("mouseup", up);
		};
		document.addEventListener("mousedown", down);
		return () => document.removeEventListener("mousedown", down);
	}, [editor]);

	return { box };
}
