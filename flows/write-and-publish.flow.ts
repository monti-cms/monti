import { expect, test } from "@playwright/test";

// Flow 1 (🔴): write a post, save it, publish it, and the site shows it; change it, publish again, and the site shows the change. The cases (a refused
// publish, a conflict, a browser backup) are checked below this layer.
test("a new post is saved, published once its category exists, and shown on the site, and a change shows once it is published again", async ({
	page,
}) => {
	await page.goto("/studio");
	await page.getByRole("button", { name: "새 글 쓰기" }).click();

	await page.getByRole("textbox", { name: "Title" }).fill("흐름 테스트 글");
	await page.getByRole("textbox", { name: "본문 편집기" }).click();
	await page.keyboard.type("첫 문단입니다.");
	await page.getByRole("button", { name: "저장", exact: true }).click();
	await expect(page).toHaveURL(/\/studio\/entries\/[^/]+\/edit$/);
	const editor = page.url();

	// A post needs a category: the first publish is refused and names the field.
	await page.getByRole("button", { name: "발행하기" }).click();
	await expect(page.getByRole("alert").filter({ hasText: "Category" })).toBeVisible();

	// The category is made from the field itself, and the publish then goes through.
	await page.getByRole("button", { name: "Category 비어 있음" }).click();
	await page.getByRole("combobox", { name: "Category" }).fill("개발");
	await page.getByText("'개발' 추가").click();
	await page.getByRole("dialog").getByRole("button", { name: "저장" }).click();
	await expect(page.getByRole("dialog")).toBeHidden();
	await page.getByRole("button", { name: "발행하기" }).click();
	await expect(page.getByRole("button", { name: "발행됨" })).toBeDisabled();

	// The body is in the page's article. Publishing also fills the summary from the body, so the text is elsewhere in the page too.
	const post = "/ko/posts/흐름-테스트-글";
	expect((await page.request.get(post)).status()).toBe(200);
	await page.goto(post);
	await expect(page.getByRole("article").getByText("첫 문단입니다.")).toBeVisible();

	// A saved change stays off the site until it is published again; then the site shows it.
	await page.goto(editor);
	await page.getByRole("textbox", { name: "본문 편집기" }).click();
	await page.keyboard.press("ControlOrMeta+End");
	await page.keyboard.type(" 고친 문장입니다.");
	await page.getByRole("button", { name: "저장", exact: true }).click();
	await expect(page.getByRole("button", { name: "발행하기" })).toBeEnabled();
	await page.goto(post);
	await expect(page.getByRole("article").getByText("첫 문단입니다.")).toBeVisible();
	await expect(page.getByRole("article")).not.toContainText("고친 문장입니다.");

	await page.goto(editor);
	await page.getByRole("button", { name: "발행하기" }).click();
	await expect(page.getByRole("button", { name: "발행됨" })).toBeDisabled();
	await page.goto(post);
	await expect(page.getByRole("article")).toContainText("고친 문장입니다.");
});
