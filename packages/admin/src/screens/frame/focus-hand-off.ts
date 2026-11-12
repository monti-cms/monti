import type { Editor } from "@tiptap/react";
import { useCallback, useRef } from "react";

/**
 * One rule, in one place (docs/design/admin/tokens.md, the states section; decided while building, 2026-11-12): when the control a person just used with the
 * keyboard goes away, the focus goes to what it acted on, not to the page. A pointer's press holds no keyboard focus and moves nothing.
 *
 * - {@link useFocusHandOff} is the rule: a ref for the thing that goes away (a button, or the box around it: a banner), and where its focus goes.
 * - {@link focusText}, {@link nextStop} and {@link firstStop} are the places it goes to.
 * - {@link holdsKeyboardFocus} is its test of a press with the keyboard, for a question that closes around the control that asked.
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
 * Whether the keyboard's focus is on it: the rule's one test of "used with the keyboard". A control pressed with a pointer does not hold it,
 * also where the press focuses it; one reached with Tab, the arrows or a screen reader's own keys does. Never told from the click (`detail`):
 * a screen reader's press is a click like a pointer's.
 */
export const holdsKeyboardFocus = (element: Element) => element.matches(":focus-visible");

/** What a person does next with their own hands: after it, nothing is moved under them. */
const THEIR_OWN = ["keydown", "pointerdown", "focusin"] as const;

/** How long a view that takes another's place may take to draw its first control before the hand-off is let go. */
const DRAWN_WITHIN = 10_000;

/**
 * Gives the focus to the page's first control, now or as soon as the page draws one: a view that takes another's place may draw nothing until
 * its read is in (the comparison), and the focus handed to it must not be lost in that wait. Let go when the person does something of their
 * own first (a key, a press, a focus elsewhere), or when nothing is drawn in `DRAWN_WITHIN`.
 */
function focusFirstStopWhenDrawn() {
	const first = firstStop();
	if (first) return first.focus();
	const letGo = () => {
		drawn.disconnect();
		clearTimeout(limit);
		for (const event of THEIR_OWN) removeEventListener(event, letGo, true);
	};
	const drawn = new MutationObserver(() => {
		const found = firstStop();
		if (!found) return;
		letGo();
		if (document.activeElement === document.body) found.focus();
	});
	drawn.observe(document.body, { childList: true, subtree: true });
	const limit = setTimeout(letGo, DRAWN_WITHIN);
	for (const event of THEIR_OWN) addEventListener(event, letGo, true);
}

/**
 * Gives the focus to the text being written: the body, or the field with `titleId` when the body is not there; and when neither is (the
 * editor gave way to another view: the comparison), to that view's first control, once it is drawn. Two frames on, not now: what took the
 * control away may make the body anew (this browser's copy loaded or dropped), and the focus belongs in the one that stays. If the person has
 * gone elsewhere by then, nothing moves.
 */
export function focusText(body: () => Editor | null, titleId: string) {
	requestAnimationFrame(() =>
		requestAnimationFrame(() => {
			if (document.activeElement !== document.body) return;
			const view = body();
			// A body that gave its place away is taken down a task later, not at once: under load two frames can pass first, and the focus
			// given to it then would go nowhere. Only a body still in the page takes it.
			if (view && !view.isDestroyed && view.view.dom.isConnected) return view.commands.focus();
			const title = document.getElementById(titleId);
			if (title) title.focus();
			else focusFirstStopWhenDrawn();
		}),
	);
}

/**
 * The key that is held down now: the last one pressed, until it comes up. The focus is handed on only once it is up: a held key repeats, and
 * would repeat into what the focus was given to (Enter held on "discard" wrote empty paragraphs into the body; on "apply again" it would press
 * the next button). Only the last key matters, as only it repeats; and a key whose coming up is never told (macOS tells none for a key pressed
 * with Command; another window took the keyboard) is forgotten at the next press, so nothing waits on it for long.
 */
let heldKey: string | null = null;
if (typeof window !== "undefined") {
	addEventListener(
		"keydown",
		(event) => {
			if (!event.repeat) heldKey = event.metaKey ? null : event.code;
		},
		true,
	);
	addEventListener(
		"keyup",
		(event) => {
			if (event.code === heldKey || event.key === "Meta") heldKey = null;
		},
		true,
	);
	addEventListener("blur", () => {
		heldKey = null;
	});
}

/** Runs it now, or when the held key comes up. */
function whenKeysAreUp(run: () => void) {
	if (heldKey === null) return run();
	const up = () => {
		if (heldKey !== null) return;
		removeEventListener("keyup", up);
		removeEventListener("blur", up);
		run();
	};
	// After the listeners above (capture, at the window) have forgotten the key.
	addEventListener("keyup", up);
	addEventListener("blur", up);
}

/** Where a focus goes: the thing that takes it, or what gives it (the text, two frames on), or nowhere. */
type HandedTo = HTMLElement | (() => void) | null | undefined;

/**
 * The ref of a thing that goes away by an action of its own, or whose own control does: a button that undoes the change it stands for, a cell
 * that turns to words once saved, a banner whose button puts its matter right (the banner goes, or stays with that button gone). When the
 * keyboard's focus leaves the page with it, `to` is called with the thing (still in the document, so what stands after it can be found) and
 * says where the focus goes; it is given there once no key is down. Nothing is kept from the press: a press that fails leaves the thing and its
 * focus where they were, and a pointer's press never held the keyboard's focus.
 */
export function useFocusHandOff(to: (gone: HTMLElement) => HandedTo) {
	const latest = useRef(to);
	latest.current = to;
	// One callback for the thing's whole life: a new one each time the screen draws would be let go and taken again, focus and all.
	return useCallback((node: HTMLElement | null) => {
		if (!node) return;
		const hand = () => {
			const next = latest.current(node);
			if (!next) return;
			const waited = heldKey !== null;
			whenKeysAreUp(() => {
				if (typeof next === "function") return next();
				// After a wait the person may have gone elsewhere with another key: then nothing is moved under them.
				if (!waited || document.activeElement === document.body) next.focus();
			});
		};
		// What inside it holds the keyboard's focus. A control taken out of the page loses the focus without an event: only this remembers it.
		let held: Element | null = null;
		const keep = (event: FocusEvent) => {
			const on = event.target;
			held = on instanceof Element && node.contains(on) && holdsKeyboardFocus(on) ? on : null;
		};
		addEventListener("focusin", keep, true);
		// A pointer's press takes the keyboard's hold away, also where it moves no focus (a button in Safari and Firefox on macOS).
		const letGo = () => {
			held = null;
		};
		addEventListener("pointerdown", letGo, true);
		// Its own control went and it stayed (a banner that still has something to say): the focus that control held is handed on the same way.
		const inside = new MutationObserver(() => {
			if (!held || held.isConnected || !node.isConnected) return;
			held = null;
			if (document.activeElement === document.body) hand();
		});
		inside.observe(node, { childList: true, subtree: true });
		return () => {
			removeEventListener("focusin", keep, true);
			removeEventListener("pointerdown", letGo, true);
			inside.disconnect();
			const focused = document.activeElement;
			if (focused instanceof HTMLElement && node.contains(focused) && holdsKeyboardFocus(focused)) hand();
		};
	}, []);
}
