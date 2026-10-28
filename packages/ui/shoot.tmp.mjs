import { chromium } from "@playwright/test";

const out =
	"/private/tmp/claude-501/-Users-bh2980-Desktop-monti--claude-worktrees-redesign-e3-26a6d5/2c88aeb9-514d-4e9f-a403-f9804c390cd7/scratchpad/shots/p2";
const ids = process.argv.slice(2);
const browser = await chromium.launch();
for (const scheme of ["light", "dark"]) {
	const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: scheme });
	for (const id of ids) {
		const page = await ctx.newPage();
		await page.goto(`http://localhost:6102/iframe.html?id=${id}&viewMode=story&globals=theme:${scheme}`);
		await page.waitForTimeout(6000);
		await page.screenshot({ path: `${out}/${id}.${scheme}.png` });
		await page.close();
	}
	await ctx.close();
}
await browser.close();
