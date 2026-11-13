import type { Page } from "@playwright/test";
import { expect, operation, test, unique } from "./fixtures";
import { HOOK } from "./servers";

// The activity log on the example app (doc 13): the live site posts its events to a webhook (`hook.ts`) that a test takes down and brings back.

const main = (page: Page) => page.getByRole("main");
const row = (page: Page, title: string) => main(page).getByRole("row").filter({ hasText: title });
const rowMenu = async (page: Page, title: string) => {
	await row(page, title).hover();
	await row(page, title).getByRole("button", { name: "행 메뉴" }).click();
	return page.getByRole("menu");
};
const toast = (page: Page, text: string) => page.getByRole("listitem").filter({ hasText: text }).first();
const sidebarLog = (page: Page) => page.getByRole("navigation").getByRole("button", { name: /^활동 기록/ });
const onSite = async (page: Page, slug: string) => (await page.request.get(`/posts/${slug}`)).status();

type Arrived = { event: { id: string; type: string; ids: string[] }; headers: Record<string, string> };
/** What the webhook's other end got about one entry, oldest first. */
const arrivedFor = async (page: Page, id: string) =>
	((await (await page.request.get(`${HOOK}/arrived`)).json()) as Arrived[]).filter((each) =>
		each.event.ids.includes(id),
	);
const failedCount = async (page: Page) =>
	(await (await page.request.post("/admin/api/operations/deliveries.counts", { data: { input: {} } })).json())
		.failed as number;

/** A draft post with a title no other test has. */
async function draft(page: Page, word: string) {
	const slug = unique(word);
	const title = `글 ${slug}`;
	const made = await operation<{ id: string }>(page, "entries.create", {
		collection: "post",
		locale: "ko",
		title,
		slug,
	});
	return { id: made.output.id, slug, title };
}

test.describe("the activity log", () => {
	test.afterEach(async ({ page }) => {
		// Whatever a test did, the next one finds the webhook up.
		await page.request.post(`${HOOK}/up`);
	});

	test("13-1 13-4 a delivery that failed is counted in the sidebar and said on its row; sent again from the row's menu it arrives once, and the count is gone", async ({
		admin,
	}) => {
		const post = await draft(admin, "hook");
		const before = await failedCount(admin);
		await admin.request.post(`${HOOK}/down`);
		await operation(admin, "entries.publish", { ids: [post.id] });
		// The site's own pages heard of it; the webhook did not.
		await expect.poll(() => onSite(admin, post.slug)).toBe(200);
		await expect.poll(() => failedCount(admin)).toBe(before + 1);
		expect((await arrivedFor(admin, post.id)).filter((each) => each.event.type === "entry.published")).toHaveLength(0);

		await admin.goto("/admin#/c/post");
		await expect(sidebarLog(admin)).toContainText(String(before + 1));
		await sidebarLog(admin).click();
		await expect(admin.getByRole("heading", { level: 1 })).toHaveText("활동 기록");
		const words = `"${post.title}" 발행`;
		await expect(row(admin, words).getByRole("cell").nth(1)).toHaveText("실패");

		await admin.request.post(`${HOOK}/up`);
		await (await rowMenu(admin, words)).getByRole("menuitem", { name: "다시 보내기" }).click();
		await expect(toast(admin, "보냈습니다")).toBeVisible();
		await expect(row(admin, words)).not.toContainText("실패");
		await expect.poll(() => failedCount(admin)).toBe(before);
		if (before === 0) await expect(sidebarLog(admin)).toHaveText("활동 기록");
		else await expect(sidebarLog(admin)).toContainText(String(before));
		// It arrived once, as the event of that publish, counted from one again (a person's send starts the count over).
		const published = (await arrivedFor(admin, post.id)).filter((each) => each.event.type === "entry.published");
		expect(published).toHaveLength(1);
		expect(published[0]?.headers["monti-event-id"]).toBe(published[0]?.event.id);
		expect(published[0]?.headers["monti-attempt"]).toBe("1");
	});

	test("13-3 a person's own publish undone from the log: the row says when, and the post is off the site", async ({
		admin,
	}) => {
		const post = await draft(admin, "undo-publish");
		await operation(admin, "entries.publish", { ids: [post.id] });
		await expect.poll(() => onSite(admin, post.slug)).toBe(200);

		await admin.goto(`/admin#/activity?q=${encodeURIComponent(post.title)}`);
		const words = `"${post.title}" 발행`;
		await (await rowMenu(admin, words)).getByRole("menuitem", { name: "되돌리기" }).click();
		// From the log an undo asks first: it cannot be redone.
		const question = admin.getByRole("alertdialog");
		await expect(question).toContainText("되돌릴까요?");
		await question.getByRole("button", { name: "되돌리기" }).click();
		await expect(row(admin, words)).toContainText(/되돌림 \d\d:\d\d/);
		await expect.poll(() => onSite(admin, post.slug)).toBe(404);
		// The webhook heard of both: the publish, and the post going off the site.
		await expect
			.poll(async () => (await arrivedFor(admin, post.id)).map((each) => each.event.type))
			.toEqual(expect.arrayContaining(["entry.published", "entry.unpublished"]));
	});

	test("13-3 the log's undo says what the row cannot show before it is done: what a line made is deleted for good, and an item put back in the trash leaves the published posts that point at it", async ({
		admin,
	}) => {
		const question = admin.getByRole("alertdialog");
		const undoOf = async (words: string) => {
			await (await rowMenu(admin, words)).getByRole("menuitem", { name: "되돌리기" }).click();
			await expect(question).toContainText("되돌릴까요?");
		};

		// A memo made: undoing its line deletes the memo for good, and the question says so with the dangerous button.
		const slug = unique("undo-made");
		const memo = await operation<{ id: string }>(admin, "entries.create", {
			collection: "memo",
			locale: "ko",
			title: `메모 ${slug}`,
			slug,
		});
		await admin.goto(`/admin#/activity?q=${encodeURIComponent(slug)}`);
		const made = `"메모 ${slug}" 만듦`;
		await undoOf(made);
		await expect(question).toContainText("이 작업으로 만든 것을 영구 삭제합니다.");
		await expect(question).not.toContainText("되돌리면 다시 돌릴 수 없습니다.");
		await question.getByRole("button", { name: "되돌리기" }).click();
		await expect(row(admin, made)).toContainText(/되돌림 \d\d:\d\d/);
		const gone = await admin.request.post("/admin/api/operations/entries.get", {
			data: { input: { id: memo.output.id } },
		});
		expect(gone.status()).not.toBe(200);

		// A category a published post points at, thrown away and restored: undoing the restore throws it away again, and the question
		// says what the site loses, in the words throwing it away by hand says. Closed without undoing, nothing changes.
		const word = unique("undo-category");
		const name = `분류 ${word}`;
		const category = await operation<{ group: string; locales: Record<string, { id: string }> }>(
			admin,
			"items.saveGroup",
			{ collection: "category", locales: { ko: { title: name, slug: word } } },
		);
		const post = await draft(admin, "undo-item");
		await operation(admin, "relations.edit", {
			collection: "post",
			entryIds: [post.id],
			field: "category",
			set: category.output.group,
		});
		await operation(admin, "entries.publish", { ids: [post.id] });
		const item = { kind: "entry", id: category.output.locales.ko?.id };
		await operation(admin, "trash.move", { rows: [item] });
		await operation(admin, "trash.restore", { rows: [item] });
		await admin.goto(`/admin#/activity?q=${encodeURIComponent(word)}&kind=trash`);
		const restored = `"${name}" 복원`;
		await undoOf(restored);
		await expect(question).toContainText(/발행된 글 1편에서 이 .+ 빠집니다\./);
		await expect(question).not.toContainText("영구 삭제");
		await question.getByRole("button", { name: "취소" }).click();
		await expect(question).toBeHidden();
		await expect(row(admin, restored)).not.toContainText("되돌림");
	});
});
