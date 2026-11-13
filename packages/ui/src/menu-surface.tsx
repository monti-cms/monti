"use client";

import * as React from "react";

/** What a pointer's press is made of: all of it is taken, so nothing under the card hears half a press. */
const PRESS = [
	"pointerdown",
	"mousedown",
	"pointerup",
	"mouseup",
	"click",
	"auxclick",
	"dblclick",
	"contextmenu",
] as const;

/**
 * The card of a menu, which swallows a pointer's press while it closes. A menu told to close stays in the page while it fades, and no longer
 * takes a press itself: a second press on the row just pressed (a double click) would land on whatever is under the card, and open the list's
 * row beneath a row menu's "send again". While it closes, a press where the card stood does nothing (overlay.md: a surface that is closing
 * takes nothing; a modal has its backdrop for this, a menu has none).
 */
function MenuSurface({ closing, ref, ...props }: React.ComponentProps<"div"> & { closing: boolean }) {
	const card = React.useRef<HTMLDivElement | null>(null);
	const keep = React.useCallback(
		(node: HTMLDivElement | null) => {
			card.current = node;
			if (typeof ref === "function") return ref(node);
			if (ref) ref.current = node;
		},
		[ref],
	);
	React.useLayoutEffect(() => {
		if (!closing || !card.current) return;
		// Where the card stood when it was told to close: it shrinks as it fades, and the press is aimed at what it was.
		const stood = card.current.getBoundingClientRect();
		const swallow = (event: MouseEvent) => {
			const inside =
				event.clientX >= stood.left &&
				event.clientX <= stood.right &&
				event.clientY >= stood.top &&
				event.clientY <= stood.bottom;
			if (!inside) return;
			event.preventDefault();
			event.stopPropagation();
		};
		for (const type of PRESS) window.addEventListener(type, swallow, true);
		return () => {
			for (const type of PRESS) window.removeEventListener(type, swallow, true);
		};
	}, [closing]);
	return <div {...props} ref={keep} />;
}

/** The `render` of every menu's popup: {@link MenuSurface}, closing when the popup is no longer open. */
export const menuSurface = (props: React.ComponentProps<"div">, state: { open: boolean }) => (
	<MenuSurface {...props} closing={!state.open} />
);
