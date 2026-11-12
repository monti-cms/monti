import type { Page } from "@playwright/test";
import { test as raw } from "@playwright/test";
import { expect, operation, test, unique } from "./fixtures";
import { ADMIN, BARE, DEV, LIVE } from "./servers";

// The example app (`examples/blog`): Monti mounted on a Next.js site the way doc 16 says, built and started as a live site.

const paragraph = (id: string, text: string) => ({ id, type: "paragraph", content: [{ type: "text", text }] });
const heading = (id: string, level: number, text: string) => ({
	id,
	type: "heading",
	attrs: { level },
	content: [{ type: "text", text }],
});

async function draft(admin: Page, title: string, blocks: unknown[] = [paragraph("p1", "본문입니다.")]) {
	const slug = unique("post");
	const made = await operation<{ id: string }>(admin, "entries.create", {
		collection: "post",
		locale: "ko",
		title,
		slug,
		doc: { type: "doc", blocks },
	});
	return { id: made.output.id, slug, path: `/posts/${slug}` };
}
const publish = (admin: Page, id: string) => operation(admin, "entries.publish", { ids: [id] });
const versionOf = async (admin: Page, id: string) =>
	(await (await admin.request.post("/admin/api/operations/entries.get", { data: { input: { id } } })).json()).entry
		.version as number;
/** What a visitor with no session and no cookie gets. */
const visit = async (admin: Page, path: string) => {
	const context = await admin.context().browser()?.newContext({ baseURL: LIVE });
	if (!context) throw new Error("no browser");
	const answer = await context.request.get(path, { maxRedirects: 0 });
	const result = { status: answer.status(), text: await answer.text(), location: answer.headers().location };
	await context.close();
	return result;
};

test.describe("the site", () => {
	test("16-1 a post written and published in the admin is on the site at its public address, and on the site's lists", async ({
		admin,
	}) => {
		const title = unique("사이트에 나온 글");
		const post = await draft(admin, title);
		expect((await visit(admin, post.path)).status).toBe(404);
		await admin.goto(`/admin#/c/post/${post.id}`);
		await admin.getByRole("button", { name: "발행하기" }).click();
		await expect(admin.getByText("발행됨").first()).toBeVisible();
		const page = await visit(admin, post.path);
		expect(page.status).toBe(200);
		expect(page.text).toContain(title);
		expect(page.text).toContain("본문입니다.");
		expect((await visit(admin, "/")).text).toContain(title);
		expect((await visit(admin, "/posts")).text).toContain(title);
	});

	test("16-1 the site's own styles do not reach the admin: the list is as wide as the design says", async ({
		admin,
	}) => {
		await admin.goto("/admin#/c/post");
		const column = admin.locator("[data-slot=page-column] > div").first();
		await expect(column).toBeVisible();
		// 880px at a 1440 window (the page column's rule, `PageColumn width="list"`); the example site's `.site` column is 680px.
		await expect.poll(async () => Math.round((await column.boundingBox())?.width ?? 0)).toBe(880);
		// A table cell of the admin has no border of the site's.
		const cell = admin.getByRole("columnheader").first();
		await expect(cell).toBeVisible();
		expect(await cell.evaluate((node) => getComputedStyle(node).borderLeftWidth)).toBe("0px");
	});

	test("16-3 a change published again, an archive, the trash and a restore each show on the entry's page and on the lists at once", async ({
		admin,
	}) => {
		const title = unique("고치는 글");
		const post = await draft(admin, title);
		await publish(admin, post.id);
		// Read once, so the pages are in the site's cache.
		expect((await visit(admin, post.path)).text).toContain(title);
		expect((await visit(admin, "/posts")).text).toContain(title);

		const changed = `${title} 고침`;
		await operation(admin, "entries.save", { id: post.id, version: await versionOf(admin, post.id), title: changed });
		// Saved only: the site still shows what was published.
		expect((await visit(admin, post.path)).text).not.toContain(changed);
		await publish(admin, post.id);
		expect((await visit(admin, post.path)).text).toContain(changed);
		expect((await visit(admin, "/posts")).text).toContain(changed);
		expect((await visit(admin, "/")).text).toContain(changed);

		await operation(admin, "entries.archive", { ids: [post.id] });
		expect((await visit(admin, post.path)).status).toBe(404);
		expect((await visit(admin, "/posts")).text).not.toContain(changed);

		await operation(admin, "entries.unarchive", { ids: [post.id] });
		await publish(admin, post.id);
		expect((await visit(admin, post.path)).status).toBe(200);
		await operation(admin, "trash.move", { rows: [{ kind: "entry", id: post.id }] });
		expect((await visit(admin, post.path)).status).toBe(404);
		expect((await visit(admin, "/posts")).text).not.toContain(changed);
	});

	test("16-3 a category thrown away leaves the site and, restored, is back at once: a restored item is live again", async ({
		admin,
	}) => {
		const slug = unique("category");
		const name = unique("분류");
		const made = await operation<{ group: string; locales: Record<string, { id: string }> }>(admin, "items.saveGroup", {
			collection: "category",
			locales: { ko: { title: name, slug } },
		});
		const id = made.output.locales.ko?.id as string;
		const path = `/categories/${slug}`;
		// Read once, so the page is in the site's cache.
		expect((await visit(admin, path)).text).toContain(name);
		await operation(admin, "trash.move", { rows: [{ kind: "entry", id }] });
		expect((await visit(admin, path)).status).toBe(404);
		await operation(admin, "trash.restore", { rows: [{ kind: "entry", id }] });
		const back = await visit(admin, path);
		expect(back.status).toBe(200);
		expect(back.text).toContain(name);
	});

	test("16-2 16-7 a post with a Korean address: it is on the site at that address, and its preview opens there", async ({
		admin,
	}) => {
		const title = unique("한글 주소의 글");
		const slug = unique("한글-주소");
		const made = await operation<{ id: string }>(admin, "entries.create", {
			collection: "post",
			locale: "ko",
			title,
			slug,
			doc: { type: "doc", blocks: [paragraph("p1", "본문입니다.")] },
		});
		const link = await admin.request.post("/admin/api/operations/entries.previewLink", {
			data: { input: { id: made.output.id } },
		});
		const { token, path } = (await link.json()) as { token: string; path: string };
		expect(path).toBe(`/posts/${slug}`);
		await admin.goto(`/admin/api/preview?token=${encodeURIComponent(token)}&path=${encodeURIComponent(path)}`);
		await expect(admin.getByRole("heading", { level: 1 })).toHaveText(title);
		expect(decodeURIComponent(new URL(admin.url()).pathname)).toBe(path);
		await admin.goto("/admin/api/preview/exit");
		await publish(admin, made.output.id);
		expect((await visit(admin, encodeURI(path))).text).toContain(title);
	});

	test("16-7 an old address goes to the new one for good, a post that is not there is not found, and so is a language it has no translation in", async ({
		admin,
	}) => {
		const post = await draft(admin, unique("주소가 바뀌는 글"));
		await publish(admin, post.id);
		const moved = unique("moved");
		await operation(admin, "entries.save", { id: post.id, version: await versionOf(admin, post.id), slug: moved });
		await publish(admin, post.id);
		const old = await visit(admin, post.path);
		// Next sends the header twice (16.4): the first is where to go.
		expect([old.status, old.location?.split(", ")[0]]).toEqual([308, `/posts/${moved}`]);
		// A browser that opens the old address lands on the new one.
		await admin.goto(post.path);
		await expect(admin).toHaveURL(new RegExp(`/posts/${moved}$`));
		expect((await visit(admin, `/posts/${moved}`)).status).toBe(200);
		expect((await visit(admin, `/posts/${unique("nothing")}`)).status).toBe(404);
		expect((await visit(admin, `/en/posts/${moved}`)).status).toBe(404);
		// The source language has no prefix, and a language the site does not have is no address.
		expect((await visit(admin, `/ko/posts/${moved}`)).status).toBe(404);
		expect((await visit(admin, `/xx/posts/${moved}`)).status).toBe(404);
	});

	test("16-7 a translation's page is in its language, and a category with no page in that language is linked where it has one", async ({
		admin,
	}) => {
		const category = unique("category");
		const made = await operation<{ group: string }>(admin, "items.saveGroup", {
			collection: "category",
			locales: { ko: { title: "개발", slug: category } },
		});
		const slug = unique("post");
		const source = await operation<{ id: string }>(admin, "entries.create", {
			collection: "post",
			locale: "ko",
			title: "원문",
			slug,
			values: { category: made.output.group },
		});
		await publish(admin, source.output.id);
		const translation = await operation<{ id: string }>(admin, "translations.create", {
			source: source.output.id,
			locale: "en",
		});
		await operation(admin, "entries.save", {
			id: translation.output.id,
			version: await versionOf(admin, translation.output.id),
			title: "Translated",
		});
		await publish(admin, translation.output.id);
		await admin.goto(`/en/posts/${slug}`);
		await expect(admin.getByRole("heading", { level: 1 })).toHaveText("Translated");
		expect(await admin.locator("html").getAttribute("lang")).toBe("en");
		// The category has no English page: its link goes to the Korean one, which is there.
		const link = admin.getByRole("link", { name: "개발" });
		await expect(link).toHaveAttribute("href", `/categories/${category}`);
		expect((await visit(admin, `/categories/${category}`)).status).toBe(200);
		await admin.goto(`/posts/${slug}`);
		expect(await admin.locator("html").getAttribute("lang")).toBe("ko");
	});

	test("16-6 a post's headings are anchors, and its table of contents goes to them", async ({ admin }) => {
		const post = await draft(admin, unique("목차가 있는 글"), [
			heading("h1", 2, "왜 옮겼나"),
			paragraph("p1", "첫 문단."),
			heading("h2", 3, "무엇이 달라졌나"),
			paragraph("p2", "둘째 문단."),
			heading("h3", 2, "왜 옮겼나"),
		]);
		await publish(admin, post.id);
		await admin.goto(post.path);
		const toc = admin.getByRole("navigation", { name: "목차" });
		await expect(toc.getByRole("link")).toHaveText(["왜 옮겼나", "무엇이 달라졌나", "왜 옮겼나"]);
		expect(await admin.locator("article h2, article h3").evaluateAll((nodes) => nodes.map((node) => node.id))).toEqual([
			"왜-옮겼나",
			"무엇이-달라졌나",
			"왜-옮겼나-1",
		]);
		await toc.getByRole("link", { name: "무엇이 달라졌나" }).click();
		await expect(admin).toHaveURL(/#%EB%AC%B4%EC%97%87%EC%9D%B4-%EB%8B%AC%EB%9D%BC%EC%A1%8C%EB%82%98$/);
		await expect(admin.locator("article h3")).toBeInViewport();
	});
});

test.describe("the preview", () => {
	test("16-2 'Preview' shows a post that is not published at its public address, to this browser only; 'exit' ends it", async ({
		admin,
	}) => {
		const title = unique("아직 안 나온 글");
		const post = await draft(admin, title);
		await admin.goto(`/admin#/c/post/${post.id}`);
		const opened = admin.waitForEvent("popup");
		await admin.getByRole("button", { name: "미리보기" }).click();
		const preview = await opened;
		await preview.waitForURL(`**${post.path}`);
		await expect(preview.getByRole("heading", { level: 1 })).toHaveText(title);
		// The line that says this is a preview, with the way out; and the page tells search engines to stay out while it shows a working copy.
		await expect(preview.getByText("미리보기", { exact: true })).toBeVisible();
		await expect(preview.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
		// Anyone else gets nothing at that address: the post is not published.
		expect((await visit(admin, post.path)).status).toBe(404);
		await preview.getByRole("link", { name: "끝내기" }).click();
		await preview.waitForLoadState();
		await expect(preview.getByText("미리보기", { exact: true })).toBeHidden();
		expect((await preview.request.get(post.path)).status()).toBe(404);
	});

	test("16-2 a published post's preview shows what is being written, and without the preview its page is what was published", async ({
		admin,
	}) => {
		const title = unique("나온 글");
		const post = await draft(admin, title);
		await publish(admin, post.id);
		const next = `${title} 다음 판`;
		await operation(admin, "entries.save", { id: post.id, version: await versionOf(admin, post.id), title: next });
		const link = await admin.request.post("/admin/api/operations/entries.previewLink", {
			data: { input: { id: post.id } },
		});
		const { token, path } = (await link.json()) as { token: string; path: string };
		expect(path).toBe(post.path);
		await admin.goto(`/admin/api/preview?token=${encodeURIComponent(token)}&path=${encodeURIComponent(path)}`);
		await expect(admin.getByRole("heading", { level: 1 })).toHaveText(next);
		// Another post opened during the preview is what the site shows of it.
		const other = await draft(admin, unique("다른 글"));
		expect((await admin.request.get(other.path)).status()).toBe(404);
		expect((await visit(admin, post.path)).text).toContain(title);
		expect((await visit(admin, post.path)).text).not.toContain(next);
		// While the working copy shows, search engines are told to stay out; the published page says no such thing.
		await expect(admin.locator('meta[name="robots"]')).toHaveAttribute("content", "noindex, nofollow");
		await admin.goto("/admin/api/preview/exit");
		await admin.goto(post.path);
		await expect(admin.getByRole("heading", { level: 1 })).toHaveText(title);
		await expect(admin.locator('meta[name="robots"]')).toHaveCount(0);
	});

	test("16-2 a ticket that is forged turns no preview on, and the preview never leaves the site", async ({ admin }) => {
		const post = await draft(admin, unique("표가 틀린 글"));
		const forged = await admin.request.get(`/admin/api/preview?token=forged&path=${encodeURIComponent(post.path)}`, {
			maxRedirects: 0,
		});
		expect(forged.status()).toBe(401);
		expect((await admin.request.get(post.path)).status()).toBe(404);
		const link = await admin.request.post("/admin/api/operations/entries.previewLink", {
			data: { input: { id: post.id } },
		});
		const { token } = (await link.json()) as { token: string };
		const away = await admin.request.get(
			`/admin/api/preview?token=${encodeURIComponent(token)}&path=${encodeURIComponent("https://example.com/")}`,
			{ maxRedirects: 0 },
		);
		expect(away.status()).toBe(400);
	});
});

raw.describe("the dev server and the live site", () => {
	raw(
		"16-5 on the dev server a browser of this machine gets into the admin without signing in",
		async ({ browser }) => {
			const context = await browser.newContext({
				baseURL: DEV,
				locale: "ko-KR",
				viewport: { width: 1440, height: 900 },
			});
			const page = await context.newPage();
			await page.goto("/admin");
			await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
			await expect(page.getByLabel("이메일")).toBeHidden();
			const state = await page.request.post("/admin/api/operations/auth.state", { data: { input: {} } });
			expect(((await state.json()) as { session: unknown }).session).toEqual({ who: "dev", bypass: true });
			await context.close();
		},
	);

	raw(
		"16-5 the dev server's admin is drawn, and lets in, at this machine's other name too (127.0.0.1)",
		async ({ browser }) => {
			const context = await browser.newContext({
				baseURL: DEV.replace("localhost", "127.0.0.1"),
				locale: "ko-KR",
				viewport: { width: 1440, height: 900 },
			});
			const page = await context.newPage();
			await page.goto("/admin");
			await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
			await expect(page.getByLabel("이메일")).toBeHidden();
			await context.close();
		},
	);

	raw(
		"16-5 on the dev server a sender that only says it is local gets nothing: forged headers, a made-up ticket",
		async ({ request }) => {
			// What a program on another machine would send: the headers a local request has, and no ticket from this machine's loopback address.
			const forged = { "x-forwarded-host": new URL(DEV).host, "x-forwarded-for": "127.0.0.1" };
			const counts = await request.post(`${DEV}/admin/api/operations/frame.counts`, {
				data: { input: {} },
				headers: forged,
			});
			expect(counts.status()).toBe(401);
			const state = await request.post(`${DEV}/admin/api/operations/auth.state`, {
				data: { input: {} },
				headers: forged,
			});
			expect(((await state.json()) as { session: unknown }).session).toBeNull();
			const letIn = await request.post(`${DEV}/admin/api/operations/auth.devSignIn`, {
				data: { input: { ticket: "made-up" } },
				headers: forged,
			});
			expect(letIn.status()).toBe(401);
			expect(letIn.headers()["set-cookie"]).toBeUndefined();
			const upload = await request.put(`${DEV}/admin/api/media/bytes?name=a.png`, { data: "x", headers: forged });
			expect(upload.status()).toBe(401);
		},
	);

	raw("16-5 the live site asks to sign in, on the site with a storage and the one without", async ({ browser }) => {
		for (const baseURL of [LIVE, BARE]) {
			const context = await browser.newContext({ baseURL, locale: "ko-KR" });
			const page = await context.newPage();
			const refused = await page.request.post("/admin/api/operations/frame.counts", { data: { input: {} } });
			expect(refused.status()).toBe(401);
			await page.goto("/admin");
			await expect(page.getByLabel("이메일")).toBeVisible();
			await page.getByLabel("이메일").fill(ADMIN.email);
			await page.getByLabel("비밀번호", { exact: true }).fill(ADMIN.password);
			await page.getByRole("button", { name: "로그인" }).click();
			await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
			await context.close();
		}
	});

	raw("16-1 the admin's page tells search engines to stay out", async ({ request }) => {
		const page = await request.get(`${LIVE}/admin`);
		expect(await page.text()).toMatch(/<meta[^>]+name="robots"[^>]+content="noindex, nofollow"/);
	});
});
