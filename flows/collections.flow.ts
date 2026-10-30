import { expect, test } from "@playwright/test";

// Flow 4 (🔴): change a collection in the settings, save and apply it, and the editor uses the new schema. The schema screen writes `monti.schema.ts`
// of the app (`flows/.app`, a copy); a field rename, a new address or a deleted collection are cases checked below this layer.
test("a field renamed in the collection settings is applied and shown in the post editor", async ({ page }) => {
	await page.goto("/studio/settings/collections?section=fields");
	await page.getByRole("button", { name: "summary 필드 편집" }).click();
	const name = page.getByRole("textbox", { name: "표시 이름" });
	await expect(name).toHaveValue("Summary");
	await name.fill("Lead");
	await page.getByRole("button", { name: "저장", exact: true }).click();

	await page.getByRole("button", { name: "저장하고 적용" }).click();
	// Applying reloads the page on the new schema.
	const reloaded = page.waitForEvent("load");
	await page.getByRole("dialog").getByRole("button", { name: "적용", exact: true }).click();
	await reloaded;
	// The new schema file makes `next dev` compile the app again, which can take longer than a usual wait.
	await expect(page.getByRole("button", { name: "summary 필드 편집" })).toBeVisible({ timeout: 60_000 });
	await expect(page.getByRole("button", { name: "저장하고 적용" })).toBeHidden();

	await page.goto("/studio/entries/new?collection=post");
	await expect(page.getByRole("button", { name: "Lead 비어 있음" })).toBeVisible();
	await expect(page.getByRole("button", { name: "Summary 비어 있음" })).toBeHidden();
});
