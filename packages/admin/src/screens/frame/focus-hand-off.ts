import type { Editor } from "@tiptap/react";
import { useCallback, useRef } from "react";

/** What the Tab key stops on. */
const STOPS =
	'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])';

/**
 * The first thing the Tab key stops on after a node, outside it: under a banner at the top of the page area, the page's first control.
 */
export function nextStop(node: Element) {
	for (const stop of document.querySelectorAll<HTMLElement>(STOPS)) {
		const after = node.compareDocumentPosition(stop) & Node.DOCUMENT_POSITION_FOLLOWING;
		if (after && !node.contains(stop) && stop.getClientRects().length > 0 && !stop.closest("[inert]")) return stop;
	}
	return null;
}

/**
 * Gives the focus to the text being written: the body, or the field with `elseId` (the title) when the body is not there. Two frames on, not now:
 * what took the control away may make the body anew (this browser's copy loaded or dropped), and the focus belongs in the one that stays. If
 * the person has gone elsewhere by then, nothing moves.
 */
export function focusText(body: () => Editor | null, elseId: string) {
	requestAnimationFrame(() =>
		requestAnimationFrame(() => {
			if (document.activeElement !== document.body) return;
			const view = body();
			if (view && !view.isDestroyed) view.commands.focus();
			else document.getElementById(elseId)?.focus();
		}),
	);
}

/**
 * A ref for what goes away by its own action (a banner whose button puts its matter right): when it leaves the page with the keyboard's focus
 * in it, `hand` is called, the thing still in the document, to give that focus to what the action was about. Without it the focus falls to the
 * page (docs/design/admin/tokens.md, the states section: where the focus goes when what held it is gone). A pointer's press holds no keyboard
 * focus and moves nothing.
 */
export function useFocusHandOff(hand: (gone: HTMLElement) => void) {
	const latest = useRef(hand);
	latest.current = hand;
	// One callback for the thing's whole life: a new one each time the screen draws would be let go and taken again, focus and all.
	return useCallback((node: HTMLElement | null) => {
		if (!node) return;
		return () => {
			const held = document.activeElement;
			if (held instanceof HTMLElement && node.contains(held) && held.matches(":focus-visible")) latest.current(node);
		};
	}, []);
}
