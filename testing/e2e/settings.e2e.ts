import type { Page } from "@playwright/test";
import { expect, operation, test, unique } from "./fixtures";
import { ADMIN } from "./servers";

const toast = (page: Page, text: string) => page.getByRole("listitem").filter({ hasText: text }).first();
const tab = (page: Page, name: string) => page.getByRole("link", { name });
/** The site's name over the sidebar. */
const siteName = (page: Page) => page.locator("[data-slot=sidebar-header]");

test.describe("settings", () => {
	test("12-2 12-3 on the live site a site name is saved at once and stays after a reload, while the structure values are locked and no save changes them", async ({
		admin,
	}) => {
		const name = unique("사이트");
		await admin.goto("/admin#/settings/site");
		await admin.getByRole("textbox", { name: "사이트 이름" }).fill(name);
		// The live site saves admin values only: the pill says so, and no review opens.
		await admin.getByRole("button", { name: "저장", exact: true }).click();
		await expect(toast(admin, "저장했습니다")).toBeVisible();
		await expect(admin.getByRole("dialog")).toBeHidden();
		await expect(siteName(admin)).toHaveText(name);
		await admin.reload();
		await expect(siteName(admin)).toHaveText(name);
		await expect(admin.getByRole("textbox", { name: "사이트 이름" })).toHaveValue(name);

		// The address mark and the languages are the schema file's: text with a lock, nothing to change them with.
		await expect(admin.getByRole("combobox", { name: "주소에 언어 표시" })).toBeHidden();
		await expect(admin.getByText("원문 언어만 빼고")).toBeVisible();
		await tab(admin, "언어").click();
		await expect(admin.getByRole("list", { name: "콘텐츠 언어" }).getByRole("listitem")).toHaveCount(3);
		await expect(admin.getByRole("img", { name: "운영 사이트에서는 잠김" })).toHaveCount(3);
		for (const button of ["+ 언어 추가", "바꾸기", "English 빼기"])
			await expect(admin.getByRole("button", { name: button })).toBeHidden();

		// The same door the screen saves through refuses a structure value, with the admin value sent beside it.
		const before = await operation<never>(admin, "settings.read", {});
		const refused = await admin.request.post("/admin/api/operations/settings.save", {
			data: {
				input: {
					site: { name: "refused" },
					locales: { source: "ko", list: [{ code: "ko", name: "한국어" }], prefix: "never" },
				},
			},
		});
		expect(refused.status()).toBe(403);
		expect(await operation<never>(admin, "settings.read", {})).toEqual(before);
	});

	test("12-2 the screen language is saved the moment it is picked, and the sign-in screen follows it after signing out", async ({
		admin,
	}) => {
		await admin.goto("/admin#/settings/admin");
		try {
			await admin.getByRole("combobox", { name: "화면 언어" }).click();
			await admin.getByRole("option", { name: /English/ }).click();
			await expect(admin.getByRole("button", { name: "Sign out" })).toBeVisible();
			// Saved, not only shown: a reload opens in English.
			await admin.reload();
			await expect(admin.getByRole("button", { name: "Sign out" })).toBeVisible();
			await admin.getByRole("button", { name: "Sign out" }).click();
			await expect(admin.getByRole("button", { name: "Sign in", exact: true })).toBeVisible();
		} finally {
			// The other flows read the admin in Korean: signed in again, the language goes back.
			await admin.request.post("/admin/api/operations/auth.signIn", { data: { input: ADMIN } });
			await operation(admin, "admin.setPreference", { language: "ko" });
		}
	});
});
