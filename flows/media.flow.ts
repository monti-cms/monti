import { expect, test } from "@playwright/test";

/** A 1×1 PNG, small enough to keep in the test. */
const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	"base64",
);

// Flow 6 (🔴): upload an image in the media screen, put it in a post body from the editor's picker, save, and the file shows where it is used. The cases
// (a refused type, a replaced file, folders, deleting a file in use) are checked below this layer. The app copy stores media on disk (`flows/overlay`).
test("an uploaded image is put in a post from the picker and shows where it is used", async ({ page }) => {
	await page.goto("/studio/media");
	const chooser = page.waitForEvent("filechooser");
	await page.getByRole("button", { name: "올리기" }).first().click();
	await (await chooser).setFiles({ name: "flow-dot.png", mimeType: "image/png", buffer: PNG });
	// A file in the library has its own actions menu; a failed upload only offers to try again or take it out.
	await expect(page.getByRole("button", { name: "'flow-dot.png' 작업" })).toBeVisible();

	await page.goto("/studio/entries/new?collection=post");
	await page.getByRole("textbox", { name: "Title" }).fill("그림 있는 글");
	await page.getByRole("textbox", { name: "본문 편집기" }).click();
	await page.keyboard.type("/이미지");
	await page.keyboard.press("Enter");
	const picker = page.getByRole("dialog", { name: "라이브러리" });
	await picker
		.getByRole("button", { name: /flow-dot\.png/ })
		.first()
		.click();
	await picker.getByRole("button", { name: "넣기" }).click();
	await expect(picker).toBeHidden();
	await page.getByRole("button", { name: "저장", exact: true }).click();
	await expect(page).toHaveURL(/\/studio\/entries\/[^/]+\/edit$/);

	// The file now names the post that uses it.
	await page.goto("/studio/media");
	await page.getByRole("button", { name: "'flow-dot.png' 작업" }).click();
	await page.getByRole("menuitem", { name: "쓰는 곳" }).hover();
	await expect(page.getByRole("menuitem", { name: /그림 있는 글/ })).toBeVisible();
});
