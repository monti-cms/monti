import { expect, type Page, test } from "@playwright/test";

/** Writes a draft post and moves it to the trash from its editor. */
async function writeAndTrash(page: Page, title: string) {
	await page.goto("/studio");
	await page.getByRole("button", { name: "새 글 쓰기" }).click();
	await page.getByRole("textbox", { name: "Title" }).fill(title);
	await page.getByRole("button", { name: "저장", exact: true }).click();
	await expect(page).toHaveURL(/\/studio\/entries\/[^/]+\/edit$/);
	await trashFromEditor(page);
}

async function trashFromEditor(page: Page) {
	await page.getByRole("button", { name: "더보기" }).click();
	await page.getByRole("menuitem", { name: "휴지통으로" }).click();
	await expect(page.getByRole("banner").getByRole("button", { name: "복원" })).toBeVisible();
}

// Flow 5 (🔴): trash a post, restore it, then delete for good, one post from its row and the rest by emptying the trash.
// Which entries can be deleted, what stays behind and the 30 days are checked below this layer.
test("a trashed post is restored to the list, and trashed posts are deleted for good", async ({ page }) => {
	await writeAndTrash(page, "되살릴 글");
	await writeAndTrash(page, "지울 글");

	await page.goto("/studio");
	await page
		.getByRole("navigation", { name: "관리 메뉴" })
		.getByRole("link", { name: /^휴지통/ })
		.click();
	await expect(page).toHaveURL(/\/studio\/trash$/);
	const trash = page.getByRole("region", { name: "휴지통" });
	const restored = trash.getByRole("row").filter({ hasText: "되살릴 글" });
	const deleted = trash.getByRole("row").filter({ hasText: "지울 글" });
	await expect(deleted).toBeVisible();

	// Restore: the post leaves the trash and is back in the post list.
	await restored.getByRole("button", { name: "복원" }).click();
	await expect(restored).toBeHidden();
	await page.getByRole("navigation", { name: "관리 메뉴" }).getByRole("link", { name: "Post", exact: true }).click();
	await page.getByRole("link", { name: "되살릴 글" }).click();
	await expect(page.getByRole("banner").getByRole("button", { name: "발행하기" })).toBeVisible();
	await trashFromEditor(page);

	// Delete one post for good from its row.
	await page.goto("/studio/trash");
	await deleted.getByRole("button", { name: "더보기" }).click();
	await page.getByRole("menuitem", { name: "영구 삭제" }).click();
	await page.getByRole("alertdialog", { name: "영구 삭제할까요?" }).getByRole("button", { name: "영구 삭제" }).click();
	await expect(deleted).toBeHidden();
	await expect(restored).toBeVisible();

	// Empty the trash: the rest is deleted for good.
	await page.getByRole("button", { name: "비우기" }).click();
	await page.getByRole("alertdialog", { name: "휴지통을 비울까요?" }).getByRole("button", { name: "비우기" }).click();
	await expect(page.getByText("휴지통이 비었어요.")).toBeVisible();
	await expect(restored).toBeHidden();
});
