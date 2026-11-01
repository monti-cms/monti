import { expect, test } from "@playwright/test";

// Flow 3 (🔴): a published Korean post gets an English translation from the editor's language tabs, which is written, published, and served by the site.
// The cases (a changed source, the fields that follow the source, translating many posts) are checked below this layer.
// It makes its own category: the flows share one database, and another flow makes "개발".
test("TRANS-N4 an English translation is added to a published post, published, and served by the site", async ({
	page,
}) => {
	// The Korean source, published with its category.
	await page.goto("/studio");
	await page.getByRole("button", { name: "새 글 쓰기" }).click();
	await page.getByRole("textbox", { name: "Title" }).fill("번역할 글");
	await page.getByRole("textbox", { name: "본문 편집기" }).click();
	await page.keyboard.type("한국어 문단입니다.");
	await page.getByRole("button", { name: "Category 비어 있음" }).click();
	await page.getByRole("combobox", { name: "Category" }).fill("여행");
	await page.getByText("'여행' 추가").click();
	await page.getByRole("dialog").getByRole("button", { name: "저장" }).click();
	await expect(page.getByRole("dialog")).toBeHidden();
	await page.getByRole("button", { name: "저장", exact: true }).click();
	await expect(page).toHaveURL(/\/studio\/entries\/[^/]+\/edit$/);
	const sourceUrl = page.url();
	await page.getByRole("button", { name: "발행하기" }).click();
	await expect(page.getByRole("button", { name: "발행됨" })).toBeDisabled();

	// The English translation opens in its own editor.
	const languages = page.getByRole("navigation", { name: "언어" });
	await languages.getByRole("button", { name: "EN 번역 추가" }).click();
	await expect(languages.getByRole("link", { name: "영어 · 초안" })).toBeVisible();
	expect(page.url()).not.toBe(sourceUrl);

	await page.getByRole("textbox", { name: "Title" }).fill("Translated post");
	await page.getByRole("textbox", { name: "본문 편집기" }).click();
	await page.keyboard.press("ControlOrMeta+a");
	await page.keyboard.type("An English paragraph.");
	await page.getByRole("button", { name: "저장", exact: true }).click();
	await page.getByRole("button", { name: "발행하기" }).click();
	await expect(page.getByRole("button", { name: "발행됨" })).toBeDisabled();
	await expect(languages.getByRole("link", { name: "영어 · 발행됨" })).toBeVisible();

	// The English address draws the translation's body, not the original's. The text is looked for in the article: other parts of the page
	// (the summary, the language links) can hold either language.
	const post = "/en/posts/번역할-글";
	expect((await page.request.get(post)).status()).toBe(200);
	await page.goto(post);
	await expect(page.getByRole("article")).toContainText("An English paragraph.");
	await expect(page.getByRole("article")).not.toContainText("한국어 문단입니다.");
});
