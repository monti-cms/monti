import { expect, test } from "@playwright/test";

/** A 1×1 PNG, small enough to keep in the test. */
const PNG = Buffer.from(
	"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
	"base64",
);

// Flow 6 (🔴): upload an image in the media screen, put it in a post body from the editor's picker, save, and the file shows where it is used; once
// the post is published, the site shows the image from the storage's public address. The cases (a refused type, a replaced file, folders, deleting a
// file in use) are checked below this layer. The app copy stores media on disk (`flows/overlay`).
test("an uploaded image is put in a post from the picker, shows where it is used, and is shown by the site", async ({
	page,
}) => {
	await page.goto("/studio/media");
	const chooser = page.waitForEvent("filechooser");
	await page.getByRole("button", { name: "올리기" }).first().click();
	await (await chooser).setFiles({ name: "flow-dot.png", mimeType: "image/png", buffer: PNG });
	// A file in the library has its own actions menu; a failed upload only offers to try again or take it out.
	await expect(page.getByRole("button", { name: "'flow-dot.png' 작업" })).toBeVisible();

	await page.goto("/studio/entries/new?collection=post");
	await page.getByRole("textbox", { name: "Title" }).fill("그림 있는 글");
	await page.getByRole("textbox", { name: "본문 편집기" }).click();
	// Text too: publishing fills the summary from it.
	await page.keyboard.type("그림이 있는 문단입니다.");
	await page.keyboard.press("Enter");
	await page.keyboard.type("/이미지");
	await page.keyboard.press("Enter");
	const picker = page.getByRole("dialog", { name: "라이브러리" });
	await picker
		.getByRole("button", { name: /flow-dot\.png/ })
		.first()
		.click();
	await picker.getByRole("button", { name: "넣기" }).click();
	await expect(picker).toBeHidden();
	// An image needs alt text before the post can be published.
	await page.getByRole("toolbar", { name: "이미지 도구" }).getByRole("button", { name: "설정" }).click();
	await page.getByRole("textbox", { name: "대체 텍스트" }).fill("점 하나");
	await page.keyboard.press("Escape");
	await page.getByRole("button", { name: "저장", exact: true }).click();
	await expect(page).toHaveURL(/\/studio\/entries\/[^/]+\/edit$/);
	const editor = page.url();

	// The file now names the post that uses it.
	await page.goto("/studio/media");
	await page.getByRole("button", { name: "'flow-dot.png' 작업" }).click();
	await page.getByRole("menuitem", { name: "쓰는 곳" }).hover();
	await expect(page.getByRole("menuitem", { name: /그림 있는 글/ })).toBeVisible();

	// Published, the post's page draws the image, and the browser loads it from the storage's public address.
	await page.goto(editor);
	await page.getByRole("button", { name: "Category 비어 있음" }).click();
	await page.getByRole("combobox", { name: "Category" }).fill("그림");
	await page.getByText("'그림' 추가").click();
	await page.getByRole("dialog").getByRole("button", { name: "저장" }).click();
	await expect(page.getByRole("dialog")).toBeHidden();
	await page.getByRole("button", { name: "발행하기" }).click();
	await expect(page.getByRole("button", { name: "발행됨" })).toBeDisabled();
	await page.goto("/ko/posts/그림-있는-글");
	const image = page.getByRole("article").locator("img").first();
	await expect(image).toBeVisible();
	const src = await image.getAttribute("src");
	expect(src).toBeTruthy();
	expect((await page.request.get(src as string)).status()).toBe(200);
	await expect.poll(() => image.evaluate((node: HTMLImageElement) => node.naturalWidth)).toBeGreaterThan(0);
});
