import { expect, type Page, test } from "@playwright/test";

const TITLE = "백업 테스트 글";
const BODY = "백업에 담길 문단입니다.";
const CATEGORY = "보관";

/** Opens the Data page from the sidebar's tools (the editor has no sidebar, so from the admin's start). */
async function openData(page: Page) {
	await page.goto("/studio");
	await page.getByRole("navigation", { name: "관리 메뉴" }).getByRole("link", { name: "도구" }).click();
	await page.getByRole("navigation", { name: "도구 구역" }).getByRole("link", { name: "데이터" }).click();
}

/** Opens a row's menu in a collection's list and picks the trash. A post asks first; the caller answers. */
async function moveToTrash(page: Page, collection: string, title: string) {
	await page
		.getByRole("navigation", { name: "관리 메뉴" })
		.getByRole("link", { name: collection, exact: true })
		.click();
	const row = page.getByRole("row").filter({ hasText: title });
	await row.getByRole("button", { name: `${title} 작업` }).click();
	await page.getByRole("menuitem", { name: /휴지통으로/ }).click();
	return row;
}

/** Deletes a row of the trash for good, from its menu. */
async function deleteForGood(page: Page, title: string) {
	const row = page.getByRole("row").filter({ hasText: title });
	await row.getByRole("button", { name: "더보기" }).click();
	await page.getByRole("menuitem", { name: "영구 삭제" }).click();
	await page.getByRole("alertdialog").getByRole("button", { name: "영구 삭제" }).click();
	await expect(row).toHaveCount(0);
}

// Flow 9 (🔴): back the site up, lose everything, and restore the backup into the empty site. The cases (a refused restore, an import of loose files,
// what a backup holds) are checked below this layer. Importing entries from a zip into a site that has some goes through the same file field and the
// import sheet, and is not walked here.
test(
	"a full backup exported from the admin restores a deleted post into the emptied site",
	async ({ page }, testInfo) => {
		// A published post, with the category it needs.
		await page.goto("/studio");
		await page.getByRole("button", { name: "새 글 쓰기" }).click();
		await page.getByRole("textbox", { name: "Title" }).fill(TITLE);
		await page.getByRole("textbox", { name: "본문 편집기" }).click();
		await page.keyboard.type(BODY);
		await page.getByRole("button", { name: "Category 비어 있음" }).click();
		await page.getByRole("combobox", { name: "Category" }).fill(CATEGORY);
		await page.getByText(`'${CATEGORY}' 추가`).click();
		await page.getByRole("dialog").getByRole("button", { name: "저장" }).click();
		await expect(page.getByRole("dialog")).toBeHidden();
		await page.getByRole("button", { name: "저장", exact: true }).click();
		await expect(page).toHaveURL(/\/studio\/entries\/[^/]+\/edit$/);
		await page.getByRole("button", { name: "발행하기" }).click();
		await expect(page.getByRole("button", { name: "발행됨" })).toBeDisabled();
		const address = `/ko/posts/${TITLE.replaceAll(" ", "-")}`;
		expect((await page.request.get(address)).status()).toBe(200);

		// The full backup comes down as a zip.
		await openData(page);
		await expect(page.getByRole("region", { name: "보관 파일에 담기는 것" })).toMatchAriaSnapshot(`
		- term: 글과 분류
		- definition: "2"
	`);
		const downloading = page.waitForEvent("download");
		await page.getByRole("button", { name: "전체 내보내기" }).click();
		const backup = testInfo.outputPath("backup.zip");
		await (await downloading).saveAs(backup);

		// The site is made empty: the post and its category go to the trash, then are deleted for good.
		const postRow = await moveToTrash(page, "Post", TITLE);
		await page.getByRole("alertdialog").getByRole("button", { name: "휴지통으로" }).click();
		await expect(postRow).toHaveCount(0);
		await expect(await moveToTrash(page, "Category", CATEGORY)).toHaveCount(0);
		await page
			.getByRole("navigation", { name: "관리 메뉴" })
			.getByRole("link", { name: /^휴지통/ })
			.click();
		await deleteForGood(page, TITLE);
		await deleteForGood(page, CATEGORY);
		await expect(page.getByText("휴지통이 비었어요.")).toBeVisible();
		expect((await page.request.get(address)).status()).toBe(404);

		// The backup goes back in as it was.
		await openData(page);
		await page.getByLabel("zip 파일 고르기").setInputFiles(backup);
		const sheet = page.getByRole("dialog", { name: /있던 그대로 복원/ });
		await sheet.getByRole("button", { name: "복원", exact: true }).click();
		await expect(sheet.getByRole("heading", { name: "백업을 복원했어요" })).toBeVisible();

		// The post is back, at its address, with its body.
		const restored = await page.request.get(address);
		expect(restored.status()).toBe(200);
		expect(await restored.text()).toContain(BODY);
	},
);
