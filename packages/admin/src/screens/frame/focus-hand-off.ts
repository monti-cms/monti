import type { Editor } from "@tiptap/react";
import { useCallback, useRef } from "react";

/**
 * One rule, in one place (docs/design/admin/tokens.md, the states section; owner, 2026-11-12): when the control a person just used with the
 * keyboard goes away, the focus goes to what it acted on, not to the page. A pointer's press holds no keyboard focus and moves nothing.
 *
 * - {@link useFocusHandOff} is the rule: a ref for the thing that goes away (a button, or the box around it: a banner), and where its focus goes.
 * - {@link focusText}, {@link nextStop} and {@link firstStop} are the places it goes to.
 */

/** What can take the keyboard's focus, by what it is; whether the Tab key stops on each is asked of it (`stopsTab`). */
const FOCUSABLE = 'a[href], button, input, select, textarea, [contenteditable="true"], [tabindex]';

/**
 * Whether the Tab key stops on it: in the tab order (not `tabindex="-1"`: an unpicked tab of a row the arrow keys move in, a part's own hidden
 * input), not off, and drawn.
 */
function stopsTab(element: HTMLElement) {
	const order = element.getAttribute("tabindex");
	if (order !== null && Number(order) < 0) return false;
	if (element.matches(':disabled, [aria-disabled="true"], input[type="hidden"]')) return false;
	if (element.closest('[inert], [aria-hidden="true"]')) return false;
	return element.getClientRects().length > 0 && getComputedStyle(element).visibility === "visible";
}

/** The first thing the Tab key stops on in the page: a screen's first control. */
export function firstStop() {
	return [...document.querySelectorAll<HTMLElement>(FOCUSABLE)].find(stopsTab) ?? null;
}

/** The first thing the Tab key stops on after a node, outside it: under a banner at the top of the page area, the page's first control. */
export function nextStop(after: Element) {
	return (
		[...document.querySelectorAll<HTMLElement>(FOCUSABLE)].find(
			(stop) =>
				Boolean(after.compareDocumentPosition(stop) & Node.DOCUMENT_POSITION_FOLLOWING) &&
				!after.contains(stop) &&
				stopsTab(stop),
		) ?? null
	);
}

/**
 * Gives the focus to the text being written: the body, or the field with `titleId` when the body is not there; and when neither is (the
 * editor gave way to another view: the comparison), to that view's first control. Two frames on, not now: what took the control away may make
 * the body anew (this browser's copy loaded or dropped), and the focus belongs in the one that stays. If the person has gone elsewhere by then,
 * nothing moves.
 */
export function focusText(body: () => Editor | null, titleId: string) {
	requestAnimationFrame(() =>
		requestAnimationFrame(() => {
			if (document.activeElement !== document.body) return;
			const view = body();
			if (view && !view.isDestroyed) view.commands.focus();
			else (document.getElementById(titleId) ?? firstStop())?.focus();
		}),
	);
}

/**
 * The ref of a thing that goes away by an action of its own: a button that undoes the change it stands for, a cell that turns to words once
 * saved, a banner whose button puts its matter right. When the thing leaves the page with the keyboard's focus on it or in it, `to` is called
 * with it (still in the document), to give that focus to what the action was about. Nothing is kept from the press: a press that fails leaves
 * the thing and its focus where they were, and a pointer's press never held the keyboard's focus.
 */
export function useFocusHandOff(to: (gone: HTMLElement) => void) {
	const latest = useRef(to);
	latest.current = to;
	// One callback for the thing's whole life: a new one each time the screen draws would be let go and taken again, focus and all.
	return useCallback((node: HTMLElement | null) => {
		if (!node) return;
		return () => {
			const held = document.activeElement;
			if (held instanceof HTMLElement && node.contains(held) && held.matches(":focus-visible")) latest.current(node);
		};
	}, []);
}
