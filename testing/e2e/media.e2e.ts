import { mkdir, readFile, writeFile } from "node:fs/promises";
import type { Page } from "@playwright/test";
import { test as raw } from "@playwright/test";
import { ADMIN } from "./account";
import { decoded, dropFromDisk, expect, operation, pastePicture, picture, test, unique } from "./fixtures";

const main = (page: Page) => page.getByRole("main");
const tile = (page: Page, name: string) =>
	main(page)
		.getByRole("button", { name: new RegExp(name) })
		.first();
const body = (page: Page) => page.getByRole("textbox", { name: "본문" });

/** A post with one paragraph, open in the editor. */
async function writing(page: Page, more: Record<string, unknown> = {}) {
	const slug = unique("post");
	const made = await operation<{ id: string }>(page, "entries.create", {
		collection: "post",
		locale: "ko",
		title: `글 ${slug}`,
		slug,
		doc: {
			type: "doc",
			blocks: [{ id: "p1", type: "paragraph", content: [{ type: "text", text: "글의 첫 문단이에요." }] }],
		},
		...more,
	});
	await page.goto(`/#/c/post/${made.output.id}`);
	await expect(body(page)).toBeVisible();
	return { id: made.output.id, slug };
}

const saveKeys = async (page: Page) => {
	await page.keyboard.press("ControlOrMeta+S");
	await expect(page.getByRole("button", { name: "저장 전 변경사항" })).toBeHidden();
};

test.describe("the library", () => {
	test("09-3 a photo dropped from disk goes over HTTP to disk, and after a reload is a tile whose picture loads", async ({
		admin,
	}, info) => {
		const file = await picture(admin, info.outputDir, `${unique("desk")}.jpg`, { width: 4032, height: 2688 });
		await admin.goto("/#/media");
		await expect(main(admin).getByRole("heading", { level: 1 })).toBeVisible();
		const name = file.split("/").at(-1) ?? "";
		await dropFromDisk(admin, [file], main(admin));
		const item = tile(admin, name);
		await expect(item).toBeVisible();
		await expect(main(admin).getByText("2400×1600 · 사용 안 함").first()).toBeVisible();
		await admin.reload();
		await expect(item).toBeVisible();
		const shown = item.locator("img");
		await expect.poll(() => decoded(shown)).toBeGreaterThan(0);
		// The web copy is what the tile loads, and the original is kept beside it.
		expect(await decoded(shown)).toBe(2400);
	});

	test("09-1 a file nobody uses goes to the trash and comes back; one in use stays and the toast shows why", async ({
		admin,
	}, info) => {
		const [freeFile, usedFile] = [
			await picture(admin, info.outputDir, `${unique("free")}.jpg`),
			await picture(admin, info.outputDir, `${unique("used")}.jpg`),
		];
		const [freeName, usedName] = [freeFile.split("/").at(-1) ?? "", usedFile.split("/").at(-1) ?? ""];
		await admin.goto("/#/media");
		await dropFromDisk(admin, [freeFile, usedFile], main(admin));
		await expect(tile(admin, freeName)).toBeVisible();
		await expect(tile(admin, usedName)).toBeVisible();
		const { items } = (await (
			await admin.request.post("/admin/api/operations/media.query", { data: { input: { search: usedName } } })
		).json()) as { items: { id: string }[] };
		const used = items[0]?.id;
		const post = await writing(admin, { values: { cover: { media: used, alt: "표지" } } });
		await admin.goto("/#/media");
		await admin.getByRole("checkbox", { name: `${freeName} 고르기` }).check({ force: true });
		await admin.getByRole("checkbox", { name: `${usedName} 고르기` }).check({ force: true });
		await main(admin).getByRole("button", { name: "휴지통으로" }).click();
		const said = admin.getByText("1개를 옮겼고 1개는 쓰이고 있어 남겼어요");
		await expect(said).toBeVisible();
		await expect(tile(admin, freeName)).toBeHidden();
		await expect(tile(admin, usedName)).toBeVisible();
		await admin.getByRole("listitem").filter({ hasText: "남겼어요" }).getByRole("button", { name: "보기" }).click();
		await expect(admin.getByRole("complementary").getByRole("link", { name: post.slug })).toBeVisible();
	});

	test("09-5 replacing a file: the site shows the new picture, and the entry keeps its words", async ({
		admin,
	}, info) => {
		const first = await picture(admin, info.outputDir, `${unique("first")}.jpg`, { width: 300, height: 200 });
		const name = first.split("/").at(-1) ?? "";
		await admin.goto("/#/media");
		await dropFromDisk(admin, [first], main(admin));
		await expect(tile(admin, name)).toBeVisible();
		const { items } = (await (
			await admin.request.post("/admin/api/operations/media.query", { data: { input: { search: name } } })
		).json()) as { items: { id: string }[] };
		const id = items[0]?.id ?? "";
		const post = await writing(admin, {
			values: { cover: { media: id, alt: "표지" } },
			doc: { type: "doc", blocks: [{ id: "i1", type: "image", attrs: { media: id, alt: "그대로 남을 말" } }] },
		});
		await operation(admin, "entries.publish", { ids: [post.id] });
		const site = await admin.context().newPage();
		await site.goto(`/site/post/${post.slug}`);
		const before = await site.getByRole("img").getAttribute("src");

		const second = await picture(admin, info.outputDir, `${unique("second")}.jpg`, { width: 500, height: 400 });
		await admin.goto(`/#/media?file=${id}`);
		const panel = admin.getByRole("complementary");
		await panel.getByRole("button", { name: "더 보기" }).click();
		const chooser = admin.waitForEvent("filechooser");
		await admin.getByRole("menuitem", { name: "파일 바꾸기" }).click();
		await (await chooser).setFiles(second);
		await admin.getByRole("alertdialog").getByRole("button", { name: "바꾸기" }).click();
		await expect(admin.getByRole("alertdialog")).toBeHidden();

		await site.reload();
		const image = site.getByRole("img");
		await expect(image).toHaveAttribute("alt", "그대로 남을 말");
		expect(await image.getAttribute("src")).not.toBe(before);
		await expect.poll(() => decoded(image)).toBe(500);
		await site.close();
	});

	test("09-1 a type the library does not take stays with its reason; one too big shrinks and goes up; a disguised file is refused at the server", async ({
		admin,
	}, info) => {
		await admin.goto("/#/media");
		await expect(main(admin).getByRole("heading", { level: 1 })).toBeVisible();
		await mkdir(info.outputDir, { recursive: true });
		const exe = `${info.outputDir}/setup.exe`;
		await writeFile(exe, new Uint8Array([0x4d, 0x5a, 0x90, 0]));
		const big = await picture(admin, info.outputDir, `${unique("big")}.png`, {
			width: 2600,
			height: 2200,
			noise: true,
		});
		expect((await readFile(big)).length).toBeGreaterThan(10 * 1024 * 1024);
		await dropFromDisk(admin, [exe, big], main(admin));
		await expect(main(admin).getByText("이미지 · PDF · ZIP · 텍스트만")).toBeVisible();
		await expect(main(admin).getByText(/MB · 10 MB까지/)).toBeVisible();
		await main(admin).getByRole("button", { name: "줄여서 다시" }).click();
		const smaller = big.split("/").at(-1)?.replace(".png", "") ?? "";
		await expect(main(admin).getByText(/MB · 10 MB까지/)).toBeHidden({ timeout: 30_000 });
		await expect(tile(admin, smaller)).toBeVisible();
		const refused = await admin.request.put("/admin/api/media/bytes?name=photo.png", {
			data: Buffer.from([0x4d, 0x5a, 0x90, 0]),
		});
		expect(refused.status()).toBe(415);
	});

	test("09-1 a file comes down so it can run nothing, and its key cannot walk out of the folder", async ({ admin }) => {
		const up = await admin.request.put("/admin/api/media/bytes?name=notes.txt", { data: "그냥 글자" });
		expect(up.status()).toBe(200);
		const { key } = (await up.json()) as { key: string };
		const down = await admin.request.get(`/admin/api/media/files/${key}`);
		expect(down.headers()["x-content-type-options"]).toBe("nosniff");
		expect(down.headers()["content-security-policy"]).toBe("sandbox");
		expect(down.headers()["content-disposition"]).toContain("attachment");
		expect((await admin.request.get("/admin/api/media/files/..%2F..%2Fpackage.json")).status()).toBe(404);
	});
});

test.describe("the editor", () => {
	test("09-3 09-1 a picture pasted mid-text with a real ⌘V: it goes in, blocks the publish for its alt text, and shows on the site once written", async ({
		admin,
	}, info) => {
		const file = await picture(admin, info.outputDir, `${unique("paste")}.png`, { width: 800, height: 600 });
		const post = await writing(admin);
		await body(admin).getByText("글의 첫 문단이에요.").click();
		await pastePicture(admin, file);
		const caption = body(admin).getByRole("textbox", { name: "캡션" });
		await expect(caption).toBeVisible({ timeout: 20_000 });
		await saveKeys(admin);

		// The library says the body uses it, after a reload of the entry too.
		await admin.reload();
		await expect(caption).toBeVisible();

		await admin.getByRole("button", { name: /할 일/ }).click();
		await admin.getByRole("button", { name: /이미지 1개에 대체 텍스트 넣기/ }).click();
		const alt = admin.getByRole("textbox", { name: "대체 텍스트" });
		await expect(alt).toBeFocused();
		await admin.keyboard.type("A desk in the morning");
		await admin.keyboard.press("Escape");
		await saveKeys(admin);
		await admin.getByRole("button", { name: "발행하기" }).click();
		await expect(admin.getByRole("button", { name: "발행하기" })).toBeHidden({ timeout: 15_000 });

		const site = await admin.context().newPage();
		await site.goto(`/site/post/${post.slug}`);
		const image = site.getByRole("img");
		await expect(image).toHaveAttribute("alt", "A desk in the morning");
		await expect.poll(() => decoded(image)).toBe(800);
		await site.close();
	});

	test("09-4 the library sees what the body uses, and freeing it from the entry frees the file", async ({
		admin,
	}, info) => {
		const file = await picture(admin, info.outputDir, `${unique("inbody")}.png`);
		const post = await writing(admin);
		await body(admin).getByText("글의 첫 문단이에요.").click();
		await pastePicture(admin, file);
		await expect(body(admin).getByRole("textbox", { name: "캡션" })).toBeVisible({ timeout: 20_000 });
		await saveKeys(admin);
		const { items } = (await (
			await admin.request.post("/admin/api/operations/media.query", {
				data: { input: { used: ["used"], sort: "uploaded" } },
			})
		).json()) as { items: { id: string; name: string }[] };
		const used = items[0];
		const refused = await operation<{ moved: string[]; kept: string[] }>(admin, "media.trash", { ids: [used?.id] });
		expect(refused.output.kept).toEqual([used?.id]);
		const entry = (await (
			await admin.request.post("/admin/api/operations/entries.get", { data: { input: { id: post.id } } })
		).json()) as {
			entry: { version: number };
		};
		await operation(admin, "entries.save", {
			id: post.id,
			version: entry.entry.version,
			doc: { type: "doc", blocks: [{ id: "p1", type: "paragraph", content: [{ type: "text", text: "뺐어요" }] }] },
		});
		const freed = await operation<{ moved: string[]; kept: string[] }>(admin, "media.trash", { ids: [used?.id] });
		expect(freed.output.moved).toEqual([used?.id]);
	});
});

raw.describe("a session that ends", () => {
	test("09-1 a file going up with no session stays to try again, and the admin says so", async ({ admin }, info) => {
		const file = await picture(admin, info.outputDir, `${unique("session")}.jpg`);
		await admin.goto("/#/media");
		await expect(main(admin).getByRole("heading", { level: 1 })).toBeVisible();
		await admin.context().clearCookies();
		await dropFromDisk(admin, [file], main(admin));
		await expect(main(admin).getByText("올리지 못했어요")).toBeVisible();
		await expect(admin.getByText("로그인이 풀렸어요")).toBeVisible();
		// Signing in again comes back to the same screen. The file itself was only ever in that page, so it is dropped again.
		await admin.getByRole("button", { name: "다시 로그인" }).click();
		await admin.getByLabel("이메일").fill(ADMIN.email);
		await admin.getByLabel("비밀번호", { exact: true }).fill(ADMIN.password);
		await admin.getByRole("button", { name: "로그인", exact: true }).click();
		await expect(main(admin).getByRole("heading", { level: 1 })).toBeVisible();
		expect(admin.url()).toContain("#/media");
		await dropFromDisk(admin, [file], main(admin));
		await expect(tile(admin, file.split("/").at(-1) ?? "")).toBeVisible();
	});
});

const bare = "http://localhost:4174";

test("09-1 a site with no storage: two lines and the way to connect, no upload, and no image row in the '/' menu", async ({
	browser,
}) => {
	const context = await browser.newContext({ baseURL: bare, locale: "ko-KR", viewport: { width: 1440, height: 900 } });
	const page = await context.newPage();
	const signedIn = await page.request.post("/admin/api/operations/auth.signIn", {
		data: { input: { email: ADMIN.email, password: ADMIN.password } },
	});
	expect(signedIn.status()).toBe(200);
	await page.goto("/#/media");
	await expect(main(page).getByText("미디어 저장소가 없어요")).toBeVisible();
	await expect(main(page).getByRole("link", { name: "연결 방법" })).toBeVisible();
	await expect(main(page).getByRole("button", { name: "올리기" })).toBeHidden();
	const post = await writing(page);
	expect(post.id).toBeTruthy();
	await body(page).getByText("글의 첫 문단이에요.").click();
	await page.keyboard.press("End");
	await page.keyboard.type("/");
	await expect(page.getByRole("option").first()).toBeVisible();
	await expect(page.getByRole("option", { name: /^이미지/ })).toBeHidden();
	await context.close();
});
