import { test as base, expect, type Page } from "@playwright/test";
import { ADMIN } from "./account";

type Written<Output> = { output: Output };

/** Calls one operation the way the admin does, with the page's session: a test sets up what it needs through the same door (docs/testing.md). */
export async function operation<Output>(page: Page, name: string, input: unknown): Promise<Written<Output>> {
	const answer = await page.request.post(`/admin/api/operations/${name}`, { data: { input } });
	expect(answer.status(), `${name}: ${await answer.text()}`).toBe(200);
	return (await answer.json()) as Written<Output>;
}

/** A page with a session, on the admin. */
export const test = base.extend<{ admin: Page }>({
	admin: async ({ page }, use) => {
		const answer = await page.request.post("/admin/api/operations/auth.signIn", {
			data: { input: { email: ADMIN.email, password: ADMIN.password } },
		});
		expect(answer.status()).toBe(200);
		await use(page);
	},
});

export { expect };

/** A unique word, so a test finds what it made however the runs before it went (one database for one run, many tests). */
export const unique = (word: string) => `${word}-${Date.now().toString(36)}${Math.floor(Math.random() * 1000)}`;
