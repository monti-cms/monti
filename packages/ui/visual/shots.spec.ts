import { expect, test } from "@playwright/test";
import { openStory, setTheme, THEMES } from "./page";
import { STORYBOOK_DIR } from "./paths";
import { readShots } from "./stories";

// The page checks (overflow, clipped text, center ...) run in `audit.spec.ts`, as their own CI step; here only the screenshots are compared.
for (const story of readShots(STORYBOOK_DIR)) {
	test(story.id, async ({ page }) => {
		await openStory(page, story.id);

		for (const theme of THEMES) {
			await setTheme(page, theme);
			await expect.soft(page).toHaveScreenshot([theme, `${story.id}.png`], { fullPage: true });
		}
	});
}
