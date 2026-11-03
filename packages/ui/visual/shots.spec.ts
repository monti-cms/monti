import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { PNG } from "pngjs";
import { type Comparison, compareShots } from "./compare";
import { openStory, setTheme } from "./page";
import { BASELINES_DIR, CHANGED_DIR, STORYBOOK_DIR } from "./paths";
import { readShots, themesOf } from "./stories";

/** A pixel may move this far and still count as the same; see `compareShots`. */
const SHIFT = 1;
/** How far two colors may be apart and count as the same (anti-aliasing), 0 to 1. */
const THRESHOLD = 0.2;
/** Pixels that may differ after the shift is allowed for: a few, for noise in anti-aliased edges, but never a changed word. */
const MAX_DIFFERING = 20;

/** Shoots the page until two shots in a row are the same, so a part still settling is not caught half-way. */
const shoot = async (page: Page) => {
	let last = await page.screenshot({ fullPage: true, animations: "disabled", caret: "hide" });
	for (let tries = 0; tries < 4; tries++) {
		const next = await page.screenshot({ fullPage: true, animations: "disabled", caret: "hide" });
		if (next.equals(last)) return next;
		last = next;
	}
	return last;
};

const write = (file: string, data: Buffer) => {
	mkdirSync(path.dirname(file), { recursive: true });
	writeFileSync(file, data);
};

const summary = (result: Comparison | null) => {
	if (!result) return "no baseline";
	if (result.sizeChanged) return "the size changed";
	return `${result.differing} px differ (${((result.differing / result.compared) * 100).toFixed(2)}%)`;
};

/**
 * Every shot story (`stories.ts`) in its themes, compared with its PNG under `baselines/`. A story that differs is shot into `changed/` as well, with
 * one line in `changed/report-<shard>.tsv` (theme, story, how much differs): the new baselines are put together from there, and the line says how big
 * the difference is without opening an image. Each story run also lists its shots in `changed/shots-<shard>.txt`, so the full set of baselines
 * this code would have can be made without shooting again. The page checks (overflow, clipped text, center ...) run in `audit.spec.ts`.
 */
for (const story of readShots(STORYBOOK_DIR)) {
	test(story.id, async ({ page }, info) => {
		await openStory(page, story.id);
		const update = info.config.updateSnapshots;

		for (const theme of themesOf(story)) {
			await setTheme(page, theme);
			const name = path.join(theme, `${story.id}.png`);
			const baseline = path.join(BASELINES_DIR, name);
			const shot = await shoot(page);
			mkdirSync(CHANGED_DIR, { recursive: true });
			appendFileSync(path.join(CHANGED_DIR, `shots-${shard()}.txt`), `${name}\n`);

			if (update === "all" || update === "changed" || (update === "missing" && !existsSync(baseline))) {
				write(baseline, shot);
				continue;
			}

			const result = existsSync(baseline)
				? compareShots(PNG.sync.read(readFileSync(baseline)), PNG.sync.read(shot), {
						shift: SHIFT,
						threshold: THRESHOLD,
					})
				: null;
			if (result && !result.sizeChanged && result.differing <= MAX_DIFFERING) continue;

			write(path.join(CHANGED_DIR, name), shot);
			appendFileSync(path.join(CHANGED_DIR, `report-${shard()}.tsv`), `${theme}\t${story.id}\t${summary(result)}\n`);
			await info.attach(`${theme}-actual`, { body: shot, contentType: "image/png" });
			if (result) {
				await info.attach(`${theme}-expected`, { path: baseline, contentType: "image/png" });
				if (result.diff) {
					const diff = new PNG({ width: result.diff.width, height: result.diff.height });
					diff.data.set(result.diff.data);
					await info.attach(`${theme}-diff`, { body: PNG.sync.write(diff), contentType: "image/png" });
				}
			}
			expect.soft(summary(result), `${story.id} (${theme})`).toBe("the same");
		}
	});
}

/** Which part of a split run this is (`--shard=2/4` → `2`), so the shard's list of shots has a file of its own. */
function shard() {
	return test.info().config.shard?.current ?? "all";
}
