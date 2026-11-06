import type { BrowserCommand, BrowserCommandContext } from "vitest/node";

/**
 * The two inputs Vitest's `userEvent` cannot give, as browser commands (they run in Node, on Playwright's page):
 * - `movePointer`: the mouse travels along a path, passing everything on the way. `userEvent.hover` jumps to its target, so it never crosses the gap
 *   a person's pointer crosses (the table's + strip that hid when the pointer left the body, 2026-11-06).
 * - `typeKorean`: Hangul typed through an input method, syllable by syllable as a Korean keyboard composes it. `userEvent.keyboard` sends the
 *   finished letters, so code that runs while a word is still being composed is never reached.
 *
 * Tests call them through `testing/input.ts`.
 */

type Point = { x: number; y: number };

/** Playwright's page and the frame the test runs in (the provider is set in `testing/vitest.ts`). */
type PlaywrightContext = BrowserCommandContext & {
	page: import("playwright").Page;
	iframe: import("playwright").FrameLocator;
};

function playwright(context: BrowserCommandContext): PlaywrightContext {
	if (context.provider.name !== "playwright") throw new Error("testing/commands.ts needs the playwright provider");
	return context as PlaywrightContext;
}

/** Where the test's frame sits on the page, and its scale: points in a test are the frame's client coordinates. */
async function frameBox(context: PlaywrightContext) {
	const box = await context.iframe.owner().boundingBox();
	if (!box) throw new Error("the test frame is not on the page");
	const width = await context.iframe.owner().evaluate((frame) => (frame as HTMLIFrameElement).clientWidth);
	return { x: box.x, y: box.y, scale: box.width / width };
}

/**
 * Moves the mouse through `points` (the frame's client coordinates), each leg in `steps` small moves (default 10), so every element under the way
 * gets its `mousemove`, `mouseleave` and `mouseenter`.
 */
export const movePointer: BrowserCommand<[points: Point[], options?: { steps?: number }]> = async (
	context,
	points,
	options = {},
) => {
	const page = playwright(context);
	const frame = await frameBox(page);
	for (const point of points)
		await page.page.mouse.move(frame.x + point.x * frame.scale, frame.y + point.y * frame.scale, {
			steps: options.steps ?? 10,
		});
};

const INITIALS = "ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ";
const FIRST = 0xac00;
const LAST = 0xd7a3;

/** What a Korean keyboard shows while one syllable is typed: "각" is ㄱ, 가, 각. Not Hangul: null. */
function stages(char: string): string[] | null {
	const code = char.codePointAt(0) ?? 0;
	if (code < FIRST || code > LAST) return null;
	const offset = code - FIRST;
	const initial = INITIALS[Math.floor(offset / 588)] ?? "";
	const open = String.fromCodePoint(code - (offset % 28));
	return offset % 28 === 0 ? [initial, open] : [initial, open, char];
}

/**
 * Types `text` into the focused element as a Korean input method does (Chrome DevTools Protocol `Input.imeSetComposition`): each syllable is
 * composed in steps and committed when the next one starts. Other characters are inserted as they are and commit the syllable before them.
 * `commit: false` leaves the last syllable composing, as when a person stops mid-word.
 */
export const typeKorean: BrowserCommand<[text: string, options?: { commit?: boolean }]> = async (
	context,
	text,
	options = {},
) => {
	const page = playwright(context);
	const session = await page.page.context().newCDPSession(page.page);
	const insert = (value: string) => session.send("Input.insertText", { text: value });
	try {
		let composing = "";
		for (const char of text) {
			const steps = stages(char);
			if (composing) await insert(composing);
			composing = "";
			if (!steps) {
				await insert(char);
				continue;
			}
			for (const step of steps)
				await session.send("Input.imeSetComposition", {
					text: step,
					selectionStart: step.length,
					selectionEnd: step.length,
				});
			composing = char;
		}
		if (composing && options.commit !== false) await insert(composing);
	} finally {
		await session.detach();
	}
};

declare module "vitest/browser" {
	interface BrowserCommands {
		movePointer: (points: Point[], options?: { steps?: number }) => Promise<void>;
		typeKorean: (text: string, options?: { commit?: boolean }) => Promise<void>;
	}
}
