/**
 * One press does one thing, once. A key held down repeats, and its repeats would act again on whatever holds the focus next: Enter held on a
 * window's button would press the button the focus goes back to, and open the window anew. {@link letHeldKeyGo} is called when a press has
 * done its one thing and what it pressed goes away (a window told to close): from then the repeats of the key that is down do nothing, until a
 * key comes up or another is pressed. With no key down it changes nothing: the next press is a new one, and ends it.
 */
let spent = false;

if (typeof window !== "undefined") {
	addEventListener(
		"keydown",
		(event) => {
			if (!event.repeat) spent = false;
			else if (spent) {
				// Neither the browser's own doing (a button's press, a form sent from its field) nor any listener's.
				event.preventDefault();
				event.stopPropagation();
			}
		},
		true,
	);
	addEventListener(
		"keyup",
		() => {
			spent = false;
		},
		true,
	);
	addEventListener("blur", () => {
		spent = false;
	});
}

/** The key that is down now has done its thing: its repeats do nothing more. */
export function letHeldKeyGo() {
	spent = true;
}
