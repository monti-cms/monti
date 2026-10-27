import { expect, test } from "@playwright/test";
import { runPageChecks } from "./checks";
import { openStory, setTheme, THEMES } from "./page";
import { STORYBOOK_DIR } from "./paths";
import { allowedChecks, readAllStories } from "./stories";

/**
 * The automated checks over every story of the built Storybook, the admin's screens included, in light and dark, and nothing else: no shot is taken
 * or compared, so it runs on any system. Rerun it at the end of each redesign epic (`pnpm test:visual:audit`); a finding is fixed, or written
 * down under the issue that owns the screen.
 */
for (const story of readAllStories(STORYBOOK_DIR)) {
	test(story.id, async ({ page }) => {
		await openStory(page, story.id);

		for (const theme of THEMES) {
			await setTheme(page, theme);

			const allowed = allowedChecks(story);
			const findings = (await runPageChecks(page)).filter((finding) => !allowed.includes(finding.check));
			expect
				.soft(findings, `${story.id} (${theme}): ${findings.map((f) => `${f.check}: ${f.detail}`).join("; ")}`)
				.toEqual([]);
		}
	});
}
