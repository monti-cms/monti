import { afterEach } from "vitest";
import { commands } from "vitest/browser";

// A test that fails in the middle of a held drag (`dragPath` with `hold`) never lets go: the next test would start with the button down. Each
// package's browser setup imports this (not `testing/setup.ts`, which the e2e app's page loads too, outside Vitest).
afterEach(() => commands.dropPointer());

// A test leaves the keyboard's focus on the last control it used. When the next test takes its screen down, a control that hands its focus on
// (`useFocusHandOff`) hands it to the next test's screen: to its first control once one is drawn, which is then not where that test's Tab
// starts from. Each test ends with the focus on nothing.
afterEach(() => {
	if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
});
