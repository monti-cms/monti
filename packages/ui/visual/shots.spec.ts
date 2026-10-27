import { expect, type Page, test } from "@playwright/test";
import { runPageChecks } from "./checks";
import { STORYBOOK_DIR } from "./paths";
import { ALLOW_CLIPPED_TAG, ALLOW_OVERFLOW_TAG, readShots } from "./stories";

const THEMES = ["light", "dark"] as const;

/** Stops what moves: transitions and animations, the caret and the smooth scroll. The popups' enter animations would otherwise be caught half-way. */
const STILL = `*, *::before, *::after {
	animation: none !important;
	transition: none !important;
	caret-color: transparent !important;
	scroll-behavior: auto !important;
}`;

/** Waits until the story has rendered and its play function has finished, the fonts are in and the layout has not moved for two frames. */
const settle = async (page: Page, id: string) => {
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

for (const story of readShots(STORYBOOK_DIR)) {
	test(story.id, async ({ page }) => {
		await page.goto(`/iframe.html?id=${story.id}&viewMode=story`);
		await settle(page, story.id);

		for (const theme of THEMES) {
			// The toolbar's switch: the tokens' dark selector, `.dark` on `html`.
			await page.evaluate((dark) => document.documentElement.classList.toggle("dark", dark), theme === "dark");
			await page.evaluate(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

			const allowed = [
				...(story.tags.includes(ALLOW_CLIPPED_TAG) ? (["clipped"] as const) : []),
				...(story.tags.includes(ALLOW_OVERFLOW_TAG) ? (["overflow"] as const) : []),
			];
			const findings = (await runPageChecks(page)).filter(
				(finding) => !allowed.some((check) => check === finding.check),
			);
			expect
				.soft(findings, `${story.id} (${theme}): ${findings.map((f) => `${f.check}: ${f.detail}`).join("; ")}`)
				.toEqual([]);

			await expect.soft(page).toHaveScreenshot([theme, `${story.id}.png`], { fullPage: true });
		}
	});
}
