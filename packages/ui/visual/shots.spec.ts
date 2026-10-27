import { expect, test } from "@playwright/test";
import { runPageChecks } from "./checks";
import { openStory, setTheme, THEMES } from "./page";
import { STORYBOOK_DIR } from "./paths";
import { allowedChecks, readShots } from "./stories";

for (const story of readShots(STORYBOOK_DIR)) {
	test(story.id, async ({ page }) => {
		await openStory(page, story.id);

		for (const theme of THEMES) {
			await setTheme(page, theme);

			const allowed = allowedChecks(story);
			const findings = (await runPageChecks(page)).filter((finding) => !allowed.includes(finding.check));
			expect
				.soft(findings, `${story.id} (${theme}): ${findings.map((f) => `${f.check}: ${f.detail}`).join("; ")}`)
				.toEqual([]);

			await expect.soft(page).toHaveScreenshot([theme, `${story.id}.png`], { fullPage: true });
		}
	});
}
