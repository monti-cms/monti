/**
 * The key that is held down now, and the two things that depend on it: one place for both (the windows that close under a held key, and the
 * admin's focus hand-off, which waits for it to come up).
 *
 * The held key is the last one pressed, until it comes up. Only the last key matters, as only it repeats; and a key whose coming up is never
 * told (macOS tells none for a key pressed with Command; another window took the keyboard) is forgotten at the next press, so nothing waits on
 * it for long.
 */
let held: string | null = null;

/**
 * One press does one thing, once. A key held down repeats, and its repeats would act again on whatever holds the focus next: Enter held on a
 * window's button would press the button the focus goes back to, and open the window anew. {@link letHeldKeyGo} is called when a press has
 * done its one thing and what it pressed goes away (a window told to close): from then the repeats of the key that is down do nothing, until
 * it comes up or another is pressed. With no key down it changes nothing: the next press is a new one, and ends it.
 */
let spent = false;

if (typeof window !== "undefined") {
	addEventListener(
		"keydown",
		(event) => {
			if (!event.repeat) {
				held = event.metaKey ? null : event.code;
				spent = false;
			} else if (spent) {
				// Neither the browser's own doing (a button's press, a form sent from its field) nor any listener's.
				event.preventDefault();
				event.stopPropagation();
			}
		},
		true,
	);
	addEventListener(
		"keyup",
		(event) => {
			// The held key came up; or Command did, and with it whatever was pressed under it; or a key whose press was never seen here.
			if (held !== null && event.code !== held && event.key !== "Meta") return;
			held = null;
			spent = false;
		},
		true,
	);
	addEventListener("blur", () => {
		held = null;
		spent = false;
	});
}

/** The key that is down now has done its thing: its repeats do nothing more. */
export function letHeldKeyGo() {
	spent = true;
}

/**
 * Runs it now, or when the held key comes up (`waited`): what is given the focus under a held key would take that key's repeats (Enter held
 * on "discard" wrote empty paragraphs into the body it handed the focus to; on "apply again" it would press the next button).
 */
export function whenKeysAreUp(run: (waited: boolean) => void) {
	if (held === null) return run(false);
	const up = () => {
		if (held !== null) return;
		removeEventListener("keyup", up);
		removeEventListener("blur", up);
		run(true);
	};
	// After the listeners above (capture, at the window) have forgotten the key.
	addEventListener("keyup", up);
	addEventListener("blur", up);
}
