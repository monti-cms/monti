import type { Page } from "@playwright/test";
import { expect, operation, test, unique } from "./fixtures";

const main = (page: Page) => page.getByRole("main");
const row = (page: Page, title: string) => main(page).getByRole("row").filter({ hasText: title });
const rowMenu = async (page: Page, title: string) => {
	await row(page, title).hover();
	await row(page, title).getByRole("button", { name: "행 메뉴" }).click();
	return page.getByRole("menu");
};
const toast = (page: Page, text: string) => page.getByRole("listitem").filter({ hasText: text }).first();
const onSite = async (page: Page, slug: string) => (await page.request.get(`/site/post/${slug}`)).status();

/** A published post with a title no other test has. */
async function published(page: Page, word: string) {
	const slug = unique(word);
	const title = `글 ${slug}`;
	const made = await operation<{ id: string }>(page, "entries.create", {
		collection: "post",
		locale: "ko",
		title,
		slug,
	});
	await operation(page, "entries.publish", { ids: [made.output.id] });
	return { id: made.output.id, slug, title };
}

test.describe("the trash", () => {
	test("11-2 11-1 a published post thrown away from its row leaves the site after a question; restored it is a draft, and published again it is back", async ({
		admin,
	}) => {
		const post = await published(admin, "trash");
		expect(await onSite(admin, post.slug)).toBe(200);
		await admin.goto(`/#/c/post?q=${encodeURIComponent(post.slug)}`);
		await (await rowMenu(admin, post.title)).getByRole("menuitem", { name: /휴지통으로/ }).click();
		const question = admin.getByRole("alertdialog");
		await expect(question).toContainText(`‘${post.title}’의 공개가 끝납니다.`);
		await question.getByRole("button", { name: "휴지통으로" }).click();
		await expect(toast(admin, "휴지통으로 옮겼습니다")).toBeVisible();
		await expect(row(admin, post.title)).toBeHidden();
		expect(await onSite(admin, post.slug)).toBe(404);

		await admin.goto(`/#/trash?q=${encodeURIComponent(post.slug)}`);
		await (await rowMenu(admin, post.title)).getByRole("menuitem", { name: "복원" }).click();
		await toast(admin, "초안으로 복원했습니다").getByRole("button", { name: "열기" }).click();
		await expect(admin.getByRole("textbox", { name: "제목" })).toHaveValue(post.title);
		// A draft: the site does not have it until a person publishes it.
		expect(await onSite(admin, post.slug)).toBe(404);
		await admin.getByRole("button", { name: "발행하기" }).click();
		await expect.poll(() => onSite(admin, post.slug)).toBe(200);
	});

	test("11-2 the toast takes a thrown-away post back as it was: still on the site", async ({ admin }) => {
		const post = await published(admin, "undo");
		await admin.goto(`/#/c/post?q=${encodeURIComponent(post.slug)}`);
		await (await rowMenu(admin, post.title)).getByRole("menuitem", { name: /휴지통으로/ }).click();
		await admin.getByRole("alertdialog").getByRole("button", { name: "휴지통으로" }).click();
		await expect.poll(() => onSite(admin, post.slug)).toBe(404);
		await toast(admin, "휴지통으로 옮겼습니다").getByRole("button", { name: "되돌리기" }).click();
		await expect(row(admin, post.title)).toBeVisible();
		expect(await onSite(admin, post.slug)).toBe(200);
	});

	test("11-4 a post deleted for good from its own page leaves its address taken: another post cannot publish under it", async ({
		admin,
	}) => {
		const post = await published(admin, "purge");
		await operation(admin, "trash.move", { rows: [{ kind: "entry", id: post.id }] });
		await admin.goto(`/#/c/post/${post.id}`);
		await expect(admin.getByText("휴지통에 있는 글입니다")).toBeVisible();
		await expect(admin.getByText("30일 남음")).toBeVisible();
		await admin.getByRole("button", { name: "더 보기" }).click();
		await admin.getByRole("menuitem", { name: "영구 삭제" }).click();
		const question = admin.getByRole("alertdialog");
		await expect(question).toContainText(`주소 /posts/${post.slug}`);
		await question.getByRole("button", { name: "영구 삭제" }).click();
		// Deleted, the page it was on is the trash.
		await expect(main(admin).getByRole("heading", { name: "휴지통" })).toBeVisible();

		const again = await operation<{ id: string }>(admin, "entries.create", {
			collection: "post",
			locale: "ko",
			title: "같은 주소의 새 글",
			slug: post.slug,
		});
		const answer = await operation<{ published: string[]; blocked: string[] }>(admin, "entries.publish", {
			ids: [again.output.id],
		}).catch(() => null);
		expect(answer?.output.published ?? []).toEqual([]);
		expect(await onSite(admin, post.slug)).toBe(404);
	});
});
