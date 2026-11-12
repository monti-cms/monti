import type * as React from "react";

const stop = (event: React.SyntheticEvent) => {
	event.preventDefault();
	event.stopPropagation();
};
const stopKey = (event: React.KeyboardEvent) => {
	// The keys that press a button or follow a link. Tab and the rest go on: the control keeps the keyboard.
	if (event.key === "Enter" || event.key === " ") stop(event);
};

/**
 * What a working control (`loading`) is given so that a press starts nothing. It is `aria-disabled`, not `disabled`, so it keeps the focus; the
 * browser then still sends it clicks (a pointer, Enter or Space, a form's own submit by Enter in a field), and an element the caller drew it
 * over (`render`, a router link) has handlers of its own that would run before the part's. These stop the press on the way down, before any of
 * them: nothing is run, a link does not go, a form is not sent.
 */
export const BUSY_GUARD = {
	onClickCapture: stop,
	// The middle button (and the other ones) presses with `auxclick`: on a link it opens the address in a new tab.
	onAuxClickCapture: stop,
	onKeyDownCapture: stopKey,
	onKeyUpCapture: stopKey,
};
