import { chromium, type FullConfig } from "@playwright/test";

/**
 * Opens the admin once on each server before the flows start. `next dev` compiles a page and its client code on the first visit, which took
 * most of the first flow's two minutes on each copy in CI (the first install failed there waiting for its first screen). Here it is
 * done before the test clock starts, and no wait in a flow is made longer for it. The web servers are up by now (Playwright starts them first).
 */
export default async function warmUp(config: FullConfig): Promise<void> {
	const browser = await chromium.launch();
	try {
		for (const project of config.projects) {
			const baseURL = project.use.baseURL;
			if (!baseURL) continue;
			const page = await browser.newPage();
			await page.goto(`${baseURL}/studio`, { waitUntil: "networkidle", timeout: 240_000 });
			await page.close();
		}
	} finally {
		await browser.close();
	}
}
