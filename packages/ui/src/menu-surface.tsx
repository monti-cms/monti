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

/** A little longer than a card takes to fade (`--monti-duration-fast`, 150ms). */
const FADE_MS = 200;

/** How far from the first press a press is still the same one made again: a hand that presses twice does not hold still to the pixel. */
const SAME_SPOT = 6;

/** Where the pointer last pressed, and when: the press that closes a menu is the one just before it is told to close. */
let pressed: { x: number; y: number; at: number } | null = null;
if (typeof window !== "undefined") {
	window.addEventListener(
		"pointerdown",
		(event) => {
			pressed = { x: event.clientX, y: event.clientY, at: event.timeStamp };
		},
		true,
	);
	// A press ends when the pointer comes up, and it is from then that the menu fades: one held for a while is the closing press all the same.
	window.addEventListener(
		"pointerup",
		(event) => {
			if (pressed) pressed.at = event.timeStamp;
		},
		true,
	);
}

/**
 * The card of a menu, which swallows the second press of a double press while it closes. A menu told to close stays in the page while it
 * fades and no longer takes a press itself: pressed twice, a row's second press landed on whatever is under the card, and opened the list's
 * row beneath a row menu's "send again". While the card fades, a press on the spot of the press that closed it does nothing (overlay.md: a
 * surface that is closing takes nothing; a modal has its backdrop for this, a menu has none). Only that spot: a press anywhere else is
 * another press, on another thing, and is that thing's. A menu closed with the keyboard was closed by no press, and swallows none.
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
		const first = pressed;
		if (!closing || !card.current || !first) return;
		// Closed by that press only if it was on the card, and just now.
		const stood = card.current.getBoundingClientRect();
		const onCard = first.x >= stood.left && first.x <= stood.right && first.y >= stood.top && first.y <= stood.bottom;
		if (!onCard || performance.now() - first.at > FADE_MS) return;
		const swallow = (event: MouseEvent) => {
			if (Math.abs(event.clientX - first.x) > SAME_SPOT || Math.abs(event.clientY - first.y) > SAME_SPOT) return;
			event.preventDefault();
			event.stopPropagation();
		};
		const stop = () => {
			for (const type of PRESS) window.removeEventListener(type, swallow, true);
		};
		for (const type of PRESS) window.addEventListener(type, swallow, true);
		// For as long as the card fades, and no longer: a card the primitive keeps in the page after its fade would go on taking presses
		// where nothing is seen.
		const faded = setTimeout(stop, FADE_MS);
		return () => {
			clearTimeout(faded);
			stop();
		};
	}, [closing]);
	return <div {...props} ref={keep} />;
}

/** The `render` of every menu's popup: {@link MenuSurface}, closing when the popup is no longer open. */
export const menuSurface = (props: React.ComponentProps<"div">, state: { open: boolean }) => (
	<MenuSurface {...props} closing={!state.open} />
);
