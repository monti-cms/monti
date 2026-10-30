import { expect, type Page, test } from "@playwright/test";

/** Writes a post and saves it; `newTag` is made from the post's Tags field, as a person makes a tag while writing. */
async function writePost(page: Page, title: string, newTag?: string) {
	await page.goto("/studio?collection=post");
	await page.getByRole("button", { name: "새 글 쓰기" }).click();
	await page.getByRole("textbox", { name: "Title" }).fill(title);
	if (newTag) {
		await page.getByRole("button", { name: "Tags 비어 있음" }).click();
		await page.getByRole("combobox", { name: "Tags" }).fill(newTag);
		await page.getByRole("option", { name: `'${newTag}' 추가` }).click();
		await page.getByRole("dialog").getByRole("button", { name: "저장" }).click();
		await expect(page.getByRole("dialog")).toBeHidden();
	}
	await page.getByRole("button", { name: "저장", exact: true }).click();
	await expect(page).toHaveURL(/\/studio\/entries\/[^/]+\/edit$/);
}

// Flow 7 (🔴): change several posts at once from the list. The cases (a partial failure, filters, sorting) are checked below this layer.
// The flow's other half, merging two tags, is not built yet; #323 adds it here when it is ("Tag list and merge").
test("posts picked in the list get a tag together", async ({ page }) => {
	await writePost(page, "정리 글 가", "React");
	await writePost(page, "정리 글 나", "리액트");
	await writePost(page, "정리 글 다");

	// Pick two posts and add 리액트 to both from the bulk bar: the one without tags now shows it.
	await page.goto("/studio?collection=post");
	await page.getByRole("checkbox", { name: "정리 글 나 선택" }).check();
	await page.getByRole("checkbox", { name: "정리 글 다 선택" }).check();
	const bulkBar = page.getByRole("toolbar", { name: "2개 선택" });
	await bulkBar.getByRole("button", { name: "바꾸기" }).click();
	await page.getByRole("menuitem", { name: "Tags" }).click();
	await page.getByRole("menuitemcheckbox", { name: /^리액트/ }).click();
	await expect(
		page.getByRole("row", { name: /^정리 글 다 선택/ }).getByRole("cell", { name: "리액트", exact: true }),
	).toBeVisible();
});
