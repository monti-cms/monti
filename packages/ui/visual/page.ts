import type { Page } from "@playwright/test";

export const THEMES = ["light", "dark"] as const;
export type Theme = (typeof THEMES)[number];

/** Stops what moves: transitions and animations, the caret and the smooth scroll. The popups' enter animations would otherwise be caught half-way. */
const STILL = `*, *::before, *::after {
	animation: none !important;
	transition: none !important;
	caret-color: transparent !important;
	scroll-behavior: auto !important;
}`;

/** Waits until the story has rendered and its play function has finished, the fonts are in and the layout has not moved for two frames. */
export const settle = async (page: Page, id: string) => {
	await page.waitForFunction(
		() => {
			const phase = (window as { __STORYBOOK_PREVIEW__?: { currentRender?: { phase?: string } } }).__STORYBOOK_PREVIEW__
				?.currentRender?.phase;
			return phase === "finished" || phase === "completed" || phase === "errored" || phase === "aborted";
		},
		null,
		{ timeout: 20_000 },
	);
	const failed = await page.evaluate(() => document.body.classList.contains("sb-show-errordisplay"));
	if (failed) throw new Error(`${id}: the story failed to render: ${await page.locator("#error-message").innerText()}`);
	await page.addStyleTag({ content: STILL });
	await page.evaluate(async () => {
		// Text that appears after the first paint (a popup) asks for its font subsets late, so wait until none is pending.
		do await document.fonts.ready;
		while (document.fonts.status !== "loaded");
		await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
	});
};

/** Opens a story, waits for it to settle and returns once the page can be measured or shot. */
export const openStory = async (page: Page, id: string) => {
	await page.goto(`/iframe.html?id=${id}&viewMode=story`);
	await settle(page, id);
};

/** The toolbar's switch: the tokens' dark selector, `.dark` on `html`. */
export const setTheme = async (page: Page, theme: Theme) => {
	await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), theme === "dark");
	await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));
};
