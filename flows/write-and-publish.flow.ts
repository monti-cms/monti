import { expect, test } from "@playwright/test";

// Flow 1 (🔴): write a post, save it, publish it, and the site shows it. The cases (a refused publish, a conflict, a browser backup) are checked below this layer.
test("a new post is saved, published once its category exists, and shown on the site", async ({ page }) => {
	await page.goto("/studio");
	await page.getByRole("button", { name: "새 글 쓰기" }).click();

	await page.getByRole("textbox", { name: "Title" }).fill("흐름 테스트 글");
	await page.getByRole("textbox", { name: "본문 편집기" }).click();
	await page.keyboard.type("첫 문단입니다.");
	await page.getByRole("button", { name: "저장", exact: true }).click();
	await expect(page).toHaveURL(/\/studio\/entries\/[^/]+\/edit$/);

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

	const site = await page.request.get("/ko/posts/흐름-테스트-글");
	expect(site.status()).toBe(200);
	expect(await site.text()).toContain("첫 문단입니다.");
});
