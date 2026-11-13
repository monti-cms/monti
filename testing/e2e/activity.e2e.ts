import { rmSync, writeFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { test as raw } from "@playwright/test";
import { expect, operation, test, unique } from "./fixtures";
import { ADMIN, BARE, HOOK, REFRESH_DOWN } from "./servers";

// The activity log on the example app (doc 13): the live site posts its events to a webhook (`hook.ts`) that a test takes down and brings back.

const main = (page: Page) => page.getByRole("main");
const row = (page: Page, title: string) => main(page).getByRole("row").filter({ hasText: title });
const rowMenu = async (page: Page, title: string) => {
	await row(page, title).hover();
	await row(page, title).getByRole("button", { name: "더 보기" }).click();
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
/** How many of one entry's deliveries are failed: what this flow did, whatever else the site's count holds. */
const failedFor = async (page: Page, entry: string) =>
	(
		(
			await (
				await page.request.post("/admin/api/operations/activity.facets", {
					data: { input: { entry, column: "delivery" } },
				})
			).json()
		).values as { value: string; count: number }[]
	).find((each) => each.value === "failed")?.count ?? 0;
/**
 * Waits until the site has sent everything it had on the way. Making a draft posts its own event to the webhook after the answer: taken down
 * before that send, the hook fails it too, and the count is one more than the flow made (#500's CI, 13-1).
 */
const settled = (page: Page) =>
	expect
		.poll(
			async () =>
				(await (await page.request.post("/admin/api/operations/deliveries.counts", { data: { input: {} } })).json())
					.onTheWay as number,
		)
		.toBe(0);
/** The sidebar's "activity log" says the site's failed count as the server has it now. */
const sidebarSaysCount = async (page: Page) => {
	await expect
		.poll(async () => {
			const count = await failedCount(page);
			const text = (await sidebarLog(page).textContent()) ?? "";
			return count === 0 ? text === "활동 기록" : text.includes(String(count));
		})
		.toBe(true);
};

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
		await settled(admin);
		await admin.request.post(`${HOOK}/down`);
		await operation(admin, "entries.publish", { ids: [post.id] });
		// The site's own pages heard of it; the webhook did not.
		await expect.poll(() => onSite(admin, post.slug)).toBe(200);
		await expect.poll(() => failedFor(admin, post.id)).toBe(1);
		expect((await arrivedFor(admin, post.id)).filter((each) => each.event.type === "entry.published")).toHaveLength(0);

		await admin.goto("/admin#/c/post");
		await expect(sidebarLog(admin)).toContainText(/\d/);
		await sidebarSaysCount(admin);
		await sidebarLog(admin).click();
		await expect(admin.getByRole("heading", { level: 1 })).toHaveText("활동 기록");
		const words = `"${post.title}" 발행`;
		await expect(row(admin, words).getByRole("cell").nth(1)).toHaveText("실패");

		await admin.request.post(`${HOOK}/up`);
		await (await rowMenu(admin, words)).getByRole("menuitem", { name: "다시 보내기" }).click();
		await expect(toast(admin, "보냈습니다")).toBeVisible();
		await expect(row(admin, words)).not.toContainText("실패");
		await expect.poll(() => failedFor(admin, post.id)).toBe(0);
		await sidebarSaysCount(admin);
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

raw.describe("the site's cached pages, when refreshing them failed", () => {
	raw.beforeEach(() => rmSync(REFRESH_DOWN, { force: true }));
	raw.afterEach(() => rmSync(REFRESH_DOWN, { force: true }));

	// The retry is due a minute after the failure, and an admin's visit starts the sends once a minute: the real times, not moved.
	raw.setTimeout(240_000);

	raw(
		"13-4 16-3 a refresh that failed leaves the old page; an admin's visit after its retry is due sends it again behind the answer, and the page is drawn anew",
		async ({ browser }) => {
			// The second live site: its refresh can be failed (`REFRESH_DOWN`).
			const context = await browser.newContext({ baseURL: BARE, locale: "ko-KR" });
			const page = await context.newPage();
			const signedIn = await page.request.post("/admin/api/operations/auth.signIn", {
				data: { input: { email: ADMIN.email, password: ADMIN.password } },
			});
			expect(signedIn.status()).toBe(200);
			const visitor = await browser.newContext({ baseURL: BARE });
			const shown = async (path: string) => (await visitor.request.get(path)).text();

			const post = await draft(page, "cache");
			await operation(page, "entries.publish", { ids: [post.id] });
			// A change marks the pages twice, the second time two seconds later: after it, the page a visitor gets is the kept one.
			await page.waitForTimeout(3000);
			await expect.poll(() => shown(`/posts/${post.slug}`)).toContain(post.title);

			const before = await failedCount(page);
			writeFileSync(REFRESH_DOWN, "");
			const retitled = `${post.title} 고친 제목`;
			const { entry } = (await (
				await page.request.post("/admin/api/operations/entries.get", { data: { input: { id: post.id } } })
			).json()) as { entry: { version: number } };
			await operation(page, "entries.save", { id: post.id, version: entry.version, title: retitled });
			await operation(page, "entries.publish", { ids: [post.id] });
			// The publish answered, the refresh failed: the delivery is counted, and the visitor still gets the page as it was kept.
			await expect.poll(() => failedCount(page)).toBe(before + 1);
			expect(await shown(`/posts/${post.slug}`)).not.toContain(retitled);

			// The cache is back. Nothing sends the delivery yet: its retry is not due, and no admin has visited.
			rmSync(REFRESH_DOWN, { force: true });
			await page.waitForTimeout(20_000);
			expect(await failedCount(page)).toBe(before + 1);
			expect(await shown(`/posts/${post.slug}`)).not.toContain(retitled);

			// An admin's frame opening (`frame.counts`) starts the due sends behind its answer, at most once a minute. The delivery is sent from
			// there, with no request of its own around it, and the page must still be drawn anew.
			await page.waitForTimeout(41_000);
			await expect
				.poll(
					async () => {
						await page.request.post("/admin/api/operations/frame.counts", { data: { input: {} } });
						return shown(`/posts/${post.slug}`);
					},
					{ timeout: 130_000, intervals: [3000] },
				)
				.toContain(retitled);
			await expect.poll(() => failedCount(page)).toBe(before);
			await context.close();
			await visitor.close();
		},
	);
});
