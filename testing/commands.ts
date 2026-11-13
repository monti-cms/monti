import type { BrowserCommand, BrowserCommandContext } from "vitest/node";

/**
 * The inputs Vitest's `userEvent` cannot give, as browser commands (they run in Node, on Playwright's page):
 * - `movePointer`: the mouse travels along a path, passing everything on the way. `userEvent.hover` jumps to its target, so it never crosses the gap
 *   a person's pointer crosses (the table's + strip that hid when the pointer left the body, 2026-11-06).
 * - `dragPointer`: the mouse is held at the first point, travels through the others and is let go at the last: a drag as a hand makes it, which
 *   `userEvent` has no call for (a column's edge, a table's border).
 * - `typeKorean`: Hangul typed through an input method, syllable by syllable as a Korean keyboard composes it. `userEvent.keyboard` sends the
 *   finished letters, so code that runs while a word is still being composed is never reached.
 * - `pressTwice` and `keyTwice`: the same press again a set time later, with nothing waited for in between. `userEvent` waits for its target
 *   before each press, so it never presses what is on its way out (a window that fades for 150ms after its button was pressed).
 * - `holdKey`: a key held down, repeating as a held key does, until `releaseKey`. `userEvent.keyboard` lets a held key go before it presses it again.
 * - `slowCpu`: the page runs `rate` times slower (Chrome's own CPU throttling), as on a busy CI runner; `1` is full speed again. A test that waits
 *   right on a fast machine and races on a slow one fails here too.
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

/**
 * Holds the mouse at the first of `points`, moves through the rest (each leg in `steps` small moves, default 10) and lets go at the last. With
 * `hold` it is not let go: the test looks at the middle of the drag, then calls `dropPointer`.
 */
export const dragPointer: BrowserCommand<[points: Point[], options?: { steps?: number; hold?: boolean }]> = async (
	context,
	points,
	options = {},
) => {
	const page = playwright(context);
	const frame = await frameBox(page);
	const [first, ...rest] = points;
	if (!first) return;
	const at = (point: Point) => [frame.x + point.x * frame.scale, frame.y + point.y * frame.scale] as const;
	await page.page.mouse.move(...at(first));
	await page.page.mouse.down();
	try {
		for (const point of rest) await page.page.mouse.move(...at(point), { steps: options.steps ?? 10 });
	} catch (error) {
		await page.page.mouse.up();
		throw error;
	}
	if (!options.hold) await page.page.mouse.up();
};

/** Lets go of the mouse a `dragPointer` with `hold` still holds. */
export const dropPointer: BrowserCommand<[]> = async (context) => {
	await playwright(context).page.mouse.up();
};

/** Presses the mouse at `point` (the frame's client coordinates), and again `gap` milliseconds later, on whatever is there by then. */
export const pressTwice: BrowserCommand<[point: Point, gap: number]> = async (context, point, gap) => {
	const page = playwright(context);
	const frame = await frameBox(page);
	const { mouse } = page.page;
	await mouse.move(frame.x + point.x * frame.scale, frame.y + point.y * frame.scale);
	await mouse.down();
	await mouse.up();
	await page.page.waitForTimeout(gap);
	await mouse.down();
	await mouse.up();
};

/** Presses `key`, and again `gap` milliseconds later, into whatever holds the focus by then. */
export const keyTwice: BrowserCommand<[key: string, gap: number]> = async (context, key, gap) => {
	const { page } = playwright(context);
	await page.keyboard.press(key);
	await page.waitForTimeout(gap);
	await page.keyboard.press(key);
};

/** Holds `key` down: one press, then `repeats` repeats of it `every` milliseconds apart. It stays down until `releaseKey`. */
export const holdKey: BrowserCommand<[key: string, options: { repeats: number; every: number }]> = async (
	context,
	key,
	{ repeats, every },
) => {
	const { page } = playwright(context);
	// A key that is already down goes down again as its repeat.
	await page.keyboard.down(key);
	for (let nth = 0; nth < repeats; nth += 1) {
		await page.waitForTimeout(every);
		await page.keyboard.down(key);
	}
};

/** Lets go of a key `holdKey` holds. */
export const releaseKey: BrowserCommand<[key: string]> = async (context, key) => {
	await playwright(context).page.keyboard.up(key);
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

export const slowCpu: BrowserCommand<[rate: number]> = async (context, rate) => {
	const page = playwright(context);
	const session = await page.page.context().newCDPSession(page.page);
	try {
		await session.send("Emulation.setCPUThrottlingRate", { rate });
	} finally {
		await session.detach();
	}
};

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
		dragPointer: (points: Point[], options?: { steps?: number; hold?: boolean }) => Promise<void>;
		dropPointer: () => Promise<void>;
		typeKorean: (text: string, options?: { commit?: boolean }) => Promise<void>;
		pressTwice: (point: Point, gap: number) => Promise<void>;
		keyTwice: (key: string, gap: number) => Promise<void>;
		holdKey: (key: string, options: { repeats: number; every: number }) => Promise<void>;
		releaseKey: (key: string) => Promise<void>;
		slowCpu: (rate: number) => Promise<void>;
	}
}
