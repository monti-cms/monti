import css from "virtual:monti-fonts";
import { afterEach } from "vitest";
import { commands } from "vitest/browser";

/**
 * Puts the admin's fonts on the test page and waits until they are in, so sizes and line breaks are the ones a person sees. Each package's browser
 * setup imports this with its own styles.
 */
const style = document.createElement("style");
style.textContent = css;
document.head.append(style);
document.documentElement.lang = "ko";
await Promise.all([
	document.fonts.load('16px "Monti Pretendard"', "가나다 Abc 123"),
	document.fonts.load('13px "Monti Plex Mono"', "Abc 123"),
]);

// A test that fails in the middle of a held drag (`dragPath` with `hold`) never lets go: the next test would start with the button down.
afterEach(() => commands.dropPointer());
