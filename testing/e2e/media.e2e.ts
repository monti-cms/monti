import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
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

/** The id of a file once the library has it: a tile with its name shows from the moment it starts going up. */
async function uploadedId(page: Page, name: string) {
	let id = "";
	await expect
		.poll(async () => {
			const answer = await page.request.post("/admin/api/operations/media.query", {
				data: { input: { search: name } },
			});
			const { items } = (await answer.json()) as { items: { id: string }[] };
			id = items[0]?.id ?? "";
			return id;
		})
		.not.toBe("");
	return id;
}

/** A picture's words are in its settings card, at the end of the cover's line. */
const coverSettings = (page: Page) => page.getByRole("button", { name: "cover 설정" });

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
		const used = await uploadedId(admin, usedName);
		const post = await writing(admin, { values: { cover: { media: used, alt: "표지" } } });
		await admin.goto("/#/media");
		await admin.getByRole("checkbox", { name: `${freeName} 고르기` }).check({ force: true });
		await admin.getByRole("checkbox", { name: `${usedName} 고르기` }).check({ force: true });
		await main(admin).getByRole("button", { name: "휴지통으로" }).click();
		const said = admin.getByText("1개를 옮겼고 1개는 쓰는 곳이 있어 남겼어요");
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
		const id = await uploadedId(admin, name);
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
		await expect(admin.getByRole("alertdialog")).not.toContainText("\\n");
		await admin.getByRole("alertdialog").getByRole("button", { name: "바꾸기" }).click();
		await expect(admin.getByRole("alertdialog")).toBeHidden();

		await site.reload();
		const image = site.getByRole("img");
		await expect(image).toHaveAttribute("alt", "그대로 남을 말");
		expect(await image.getAttribute("src")).not.toBe(before);
		await expect.poll(() => decoded(image)).toBe(500);
		await site.close();
	});

	test("09-1 a type the library does not take stays with its reason; so does one too big; a disguised file is refused at the server", async ({
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
		await expect(main(admin).getByText("지원하지 않는 형식")).toBeVisible();
		await expect(main(admin).getByText("10 MB 초과")).toBeVisible();
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
	test("09-1 a picture in the body cut off on its way up is tried again from its box, and goes in", async ({
		admin,
	}, info) => {
		const file = await picture(admin, info.outputDir, `${unique("cut")}.png`, { width: 800, height: 600 });
		await writing(admin);
		await admin.route("**/operations/media.upload", (route) => route.abort());
		await body(admin).getByText("글의 첫 문단이에요.").click();
		await pastePicture(admin, file);
		await expect(body(admin).getByText("올리기 실패")).toBeVisible();
		await admin.unroute("**/operations/media.upload");
		await body(admin).getByRole("button", { name: "다시 올리기" }).click();
		await expect(body(admin).getByText("올리기 실패")).toBeHidden();
		await expect.poll(() => decoded(body(admin).locator("img"))).toBeGreaterThan(0);
	});

	test("09-3 09-1 a picture pasted mid-text with a real ⌘V: it goes in, blocks the publish for its alt text, and shows on the site once written", async ({
		admin,
	}, info) => {
		const file = await picture(admin, info.outputDir, `${unique("paste")}.png`, { width: 800, height: 600 });
		const post = await writing(admin);
		await body(admin).getByText("글의 첫 문단이에요.").click();
		await pastePicture(admin, file);
		const caption = body(admin).getByRole("textbox", { name: "캡션" });
		await expect(caption).toBeVisible();
		// The caption is there from the start; the picture is in the body once the library has it.
		await expect(body(admin).getByRole("progressbar")).toBeHidden({ timeout: 20_000 });
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
		await expect(body(admin).getByRole("textbox", { name: "캡션" })).toBeVisible();
		await expect(body(admin).getByRole("progressbar")).toBeHidden({ timeout: 20_000 });
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
		await expect(main(admin).getByText("올리기 실패")).toBeVisible();
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

test.describe("a cover and what goes up for it", () => {
	const hold = async (page: Page) => {
		let release = () => {};
		const released = new Promise<void>((done) => {
			release = done;
		});
		await page.route("**/media/bytes*", async (route) => {
			await released;
			await route.continue().catch(() => {});
		});
		return release;
	};
	const cover = (page: Page) => page.getByRole("button", { name: "cover", exact: true });
	const chooseUpload = async (page: Page, file: string) => {
		await cover(page).click();
		const chooser = page.waitForEvent("filechooser");
		await page.getByRole("dialog").getByRole("button", { name: "올리기" }).click();
		await (await chooser).setFiles(file);
	};

	test("09-3 a PDF chosen for a field of images says why, stays out of the library, and the entry still saves", async ({
		admin,
	}, info) => {
		const pdf = path.join(info.outputDir, `${unique("price")}.pdf`);
		await mkdir(info.outputDir, { recursive: true });
		await writeFile(pdf, "%PDF-1.7\n");
		await writing(admin);
		await chooseUpload(admin, pdf);
		await expect(admin.getByText("이미지만 가능")).toBeVisible();
		await admin.getByRole("textbox", { name: "제목" }).pressSequentially(" 고침");
		await saveKeys(admin);
		const answer = await admin.request.post("/admin/api/operations/media.query", {
			data: { input: { search: path.basename(pdf) } },
		});
		expect(((await answer.json()) as { total: number }).total).toBe(0);
	});

	test("09-1 a cover cut off on its way up is tried again from its own line, and goes in", async ({ admin }, info) => {
		const file = await picture(admin, info.outputDir, `${unique("cut")}.jpg`);
		await writing(admin);
		await admin.route("**/operations/media.upload", (route) => route.abort());
		await chooseUpload(admin, file);
		await expect(admin.getByText("올리기 실패")).toBeVisible();
		// The line is the file that stopped: it has no words to write yet.
		await expect(coverSettings(admin)).toBeHidden();
		await admin.unroute("**/operations/media.upload");
		await admin.getByRole("button", { name: "다시 올리기" }).click();
		await expect(admin.getByText("올리기 실패")).toBeHidden();
		await expect(cover(admin)).toContainText(path.basename(file));
		await expect(coverSettings(admin)).toBeVisible();
	});

	test("09-3 a cover's × takes out a file that did not go up; the cover and its alt text are as they were", async ({
		admin,
	}, info) => {
		const kept = await picture(admin, info.outputDir, `${unique("kept")}.jpg`);
		await admin.goto("/#/media");
		await expect(main(admin).getByRole("heading", { level: 1 })).toBeVisible();
		await dropFromDisk(admin, [kept], main(admin));
		const name = path.basename(kept);
		await uploadedId(admin, name);
		const pdf = path.join(info.outputDir, `${unique("price")}.pdf`);
		await writeFile(pdf, "%PDF-1.7\n");

		await writing(admin);
		await cover(admin).click();
		const dialog = admin.getByRole("dialog");
		await dialog.getByRole("textbox", { name: "파일 이름 검색" }).fill(name);
		await dialog.getByRole("button", { name: new RegExp(name) }).click();
		await dialog.getByRole("button", { name: "고르기" }).click();
		const alt = admin.getByRole("textbox", { name: "대체 텍스트" });
		await coverSettings(admin).click();
		await alt.fill("봄 표지");
		await admin.keyboard.press("Escape");

		await chooseUpload(admin, pdf);
		await expect(admin.getByText("이미지만 가능")).toBeVisible();
		await expect(admin.getByRole("button", { name: "빼기", exact: true })).toBeHidden();
		await admin.getByRole("button", { name: "cover 빼기" }).click();
		await expect(admin.getByText("이미지만 가능")).toBeHidden();
		await expect(cover(admin)).toHaveText(new RegExp(name));
		await coverSettings(admin).click();
		await expect(alt).toHaveValue("봄 표지");
	});

	test("09-3 a new file starts with no alt text, and keeps what was written for it while it went up", async ({
		admin,
	}, info) => {
		const kept = await picture(admin, info.outputDir, `${unique("kept")}.jpg`);
		await admin.goto("/#/media");
		await expect(main(admin).getByRole("heading", { level: 1 })).toBeVisible();
		await dropFromDisk(admin, [kept], main(admin));
		const name = path.basename(kept);
		await uploadedId(admin, name);
		const first = await picture(admin, info.outputDir, `${unique("first")}.jpg`);
		const second = await picture(admin, info.outputDir, `${unique("second")}.jpg`);

		await writing(admin);
		await cover(admin).click();
		const dialog = admin.getByRole("dialog");
		await dialog.getByRole("textbox", { name: "파일 이름 검색" }).fill(name);
		await dialog.getByRole("button", { name: new RegExp(name) }).click();
		await dialog.getByRole("button", { name: "고르기" }).click();
		const alt = admin.getByRole("textbox", { name: "대체 텍스트" });
		await coverSettings(admin).click();
		await alt.fill("봄 표지");
		await admin.keyboard.press("Escape");

		await chooseUpload(admin, first);
		await uploadedId(admin, path.basename(first));
		await expect(cover(admin)).toHaveText(new RegExp(path.basename(first)));
		await coverSettings(admin).click();
		await expect(alt).toHaveValue("");

		await alt.fill("첫 설명");
		await admin.keyboard.press("Escape");
		const release = await hold(admin);
		await chooseUpload(admin, second);
		await expect(cover(admin)).toHaveText(new RegExp(path.basename(second)));
		await coverSettings(admin).click();
		await alt.fill("새 설명");
		release();
		await expect(admin.getByRole("button", { name: "cover 빼기" })).toBeVisible();
		await expect
			.poll(async () => {
				const answer = await admin.request.post("/admin/api/operations/media.query", {
					data: { input: { search: path.basename(second) } },
				});
				return ((await answer.json()) as { total: number }).total;
			})
			.toBe(1);
		await expect(alt).toHaveValue("새 설명");
	});

	test("09-3 a file picked while another goes up is the one that stays", async ({ admin }, info) => {
		const kept = await picture(admin, info.outputDir, `${unique("kept")}.jpg`);
		await admin.goto("/#/media");
		await expect(main(admin).getByRole("heading", { level: 1 })).toBeVisible();
		await dropFromDisk(admin, [kept], main(admin));
		const name = path.basename(kept);
		await uploadedId(admin, name);
		const late = await picture(admin, info.outputDir, `${unique("late")}.jpg`);

		await writing(admin);
		const release = await hold(admin);
		await chooseUpload(admin, late);
		await expect(cover(admin)).toHaveText(new RegExp(path.basename(late)));
		await cover(admin).click();
		const dialog = admin.getByRole("dialog");
		await dialog.getByRole("textbox", { name: "파일 이름 검색" }).fill(name);
		await dialog.getByRole("button", { name: new RegExp(name) }).click();
		await dialog.getByRole("button", { name: "고르기" }).click();
		await expect(cover(admin)).toHaveText(new RegExp(name));
		release();
		await admin.waitForTimeout(800);
		await expect(cover(admin)).toHaveText(new RegExp(name));
	});
});

test.describe("a translation's cover", () => {
	test("09-3 it follows what the source has on the site: alt text alone, a file of its own, and back to following", async ({
		admin,
	}, info) => {
		const file = await picture(admin, info.outputDir, `${unique("cover")}.jpg`);
		const name = file.split("/").at(-1) ?? "";
		await admin.goto("/#/media");
		await expect(main(admin).getByRole("heading", { level: 1 })).toBeVisible();
		await dropFromDisk(admin, [file], main(admin));
		await uploadedId(admin, name);

		const post = await writing(admin);
		await operation(admin, "entries.publish", { ids: [post.id] });
		await admin.reload();
		const cover = admin.getByRole("button", { name: "cover", exact: true });
		const alt = admin.getByRole("textbox", { name: "대체 텍스트" });
		// Each language's page opens with its own panel state.
		const panel = () =>
			expect(async () => {
				const button = admin.getByRole("button", { name: "속성" });
				if ((await button.getAttribute("aria-pressed")) !== "true") await button.click();
				await expect(cover).toBeVisible({ timeout: 500 });
			}).toPass();
		// A translation's source pane closes the panel once it has loaded, so this looks again until the card stays.
		const card = () =>
			expect(async () => {
				await panel();
				if (!(await alt.isVisible())) await coverSettings(admin).click({ timeout: 500 });
				await expect(alt).toBeVisible({ timeout: 500 });
			}).toPass();
		await panel();
		await cover.click();
		const dialog = admin.getByRole("dialog");
		await dialog.getByRole("textbox", { name: "파일 이름 검색" }).fill(name);
		await dialog.getByRole("button", { name: new RegExp(name) }).click();
		await dialog.getByRole("button", { name: "고르기" }).click();
		await coverSettings(admin).click();
		await alt.fill("봄 표지");
		await saveKeys(admin);
		await admin.keyboard.press("Escape");

		// On the site with no cover, and the cover only saved: a translation follows what the site shows (doc 04, principle 5).
		await admin.getByRole("button", { name: "+ 언어" }).click();
		await admin.getByRole("menuitem", { name: /English/ }).click();
		await expect(admin).toHaveURL(/#\/c\/post\//);
		await expect(admin.getByRole("button", { name: "English" })).toBeVisible();
		await panel();
		await expect(cover).toHaveText(/비어 있음/);
		await expect(admin.getByText("원문의 발행본을 따라요")).toBeVisible();

		// Published: the file and its alt text show, as the source's.
		await admin.getByRole("button", { name: "한국어" }).click();
		await panel();
		await expect(cover).toHaveText(new RegExp(name));
		await admin.getByRole("button", { name: "발행하기" }).click();
		await expect(admin.getByRole("button", { name: "발행됨" })).toBeVisible();
		await admin.getByRole("button", { name: "English" }).click();
		await panel();
		await expect(cover).toHaveText(new RegExp(name));
		await card();
		await expect(alt).toHaveAttribute("placeholder", "봄 표지");
		await expect(admin.getByRole("button", { name: "cover 원문으로 되돌리기" })).toBeHidden();
		await expect(admin.getByText("원문의 발행본을 따라요")).toBeVisible();

		// Alt text alone makes it this language's, and × goes back to following.
		await alt.fill("spring cover");
		await saveKeys(admin);
		await admin.reload();
		await card();
		await expect(alt).toHaveValue("spring cover");
		await admin.keyboard.press("Escape");
		await expect(cover).toHaveText(new RegExp(name));
		await expect(admin.getByText("원문의 발행본을 따라요")).toBeHidden();
		await expect(admin.getByText("이 언어의 값이에요")).toBeVisible();
		await admin.getByRole("button", { name: "cover 원문으로 되돌리기" }).click();
		await expect(cover).toHaveText(new RegExp(name));
		await card();
		await expect(alt).toHaveValue("");
		await expect(alt).toHaveAttribute("placeholder", "봄 표지");
		await saveKeys(admin);
	});
});

test.describe("while a file is on its way", () => {
	test("09-1 leaving the library says the file stops; staying keeps it going", async ({ admin }, info) => {
		const file = await picture(admin, info.outputDir, `${unique("held")}.jpg`);
		await admin.goto("/#/media");
		await expect(main(admin).getByRole("heading", { level: 1 })).toBeVisible();
		let release = () => {};
		const released = new Promise<void>((done) => {
			release = done;
		});
		await admin.route("**/media/bytes*", async (route) => {
			await released;
			await route.continue();
		});
		await dropFromDisk(admin, [file], main(admin));
		await expect(main(admin).getByText(/올리는 중/)).toBeVisible();
		await admin.getByRole("button", { name: "memo", exact: true }).click();
		const asked = admin.getByRole("alertdialog");
		await expect(asked).toBeVisible();
		await expect(asked.getByText("파일을 올리는 중이에요")).toBeVisible();
		await expect(asked.getByText(/올라가지 않은 파일 1개/)).toBeVisible();
		await asked.getByRole("button", { name: "계속 올리기" }).click();
		await expect(main(admin).getByRole("heading", { level: 1 })).toBeVisible();
		release();
		await expect(tile(admin, file.split("/").at(-1) ?? "")).toBeVisible();
	});

	test("09-1 a file's use row leaves the screen too, so it asks first", async ({ admin }, info) => {
		const used = await picture(admin, info.outputDir, `${unique("used")}.jpg`);
		const held = await picture(admin, info.outputDir, `${unique("held")}.jpg`);
		await admin.goto("/#/media");
		await expect(main(admin).getByRole("heading", { level: 1 })).toBeVisible();
		await dropFromDisk(admin, [used], main(admin));
		const id = await uploadedId(admin, path.basename(used));
		await operation(admin, "entries.create", {
			collection: "post",
			locale: "ko",
			title: `쓰는 글 ${unique("use")}`,
			slug: unique("use"),
			doc: { type: "doc", blocks: [{ id: "i1", type: "image", attrs: { media: id, alt: "그림" } }] },
		});
		await admin.goto(`/#/media?file=${id}`);
		const panel = admin.getByRole("complementary");
		await expect(panel.getByRole("link", { name: /쓰는 글/ })).toBeVisible();
		await admin.route("**/media/bytes*", () => {});
		await dropFromDisk(admin, [held], main(admin));
		await expect(main(admin).getByText(/올리는 중/)).toBeVisible();
		await panel.getByRole("link", { name: /쓰는 글/ }).click();
		await expect(admin.getByRole("alertdialog")).toBeVisible();
		await admin.getByRole("alertdialog").getByRole("button", { name: "계속 올리기" }).click();
		await expect(main(admin).getByRole("heading", { level: 1 })).toBeVisible();
	});

	test("09-1 a picture going up stops if the translation's view changes, so it asks first; the words typed stay either way", async ({
		admin,
	}, info) => {
		const file = await picture(admin, info.outputDir, `${unique("paired")}.png`);
		const post = await writing(admin);
		await operation(admin, "entries.publish", { ids: [post.id] });
		const made = await operation<{ id: string }>(admin, "translations.create", { source: post.id, locale: "en" });
		await admin.goto(`/#/c/post/${made.output.id}`);
		await expect(body(admin)).toBeVisible();
		await admin.getByRole("textbox", { name: "제목" }).fill("A post");
		await admin.route("**/media/bytes*", () => {});
		await body(admin).click();
		await pastePicture(admin, file);
		await expect(body(admin).getByRole("progressbar")).toBeVisible();
		await admin.getByRole("button", { name: "나란히" }).click();
		const asked = admin.getByRole("alertdialog");
		await expect(asked.getByText("파일을 올리는 중이에요")).toBeVisible();
		await asked.getByRole("button", { name: "그만 올리기" }).click();
		await expect(asked).toBeHidden();
		await expect(admin.getByRole("button", { name: "나란히" })).toHaveAttribute("aria-pressed", "true");
		await expect(admin.getByRole("textbox", { name: "제목" })).toHaveValue("A post");
	});

	test("09-1 leaving anyway stops the file: the library never gets it", async ({ admin }, info) => {
		const file = await picture(admin, info.outputDir, `${unique("stopped")}.jpg`);
		const name = file.split("/").at(-1) ?? "";
		await admin.goto("/#/media");
		await expect(main(admin).getByRole("heading", { level: 1 })).toBeVisible();
		let release = () => {};
		const released = new Promise<void>((done) => {
			release = done;
		});
		await admin.route("**/media/bytes*", async (route) => {
			await released;
			await route.continue().catch(() => {});
		});
		await dropFromDisk(admin, [file], main(admin));
		await expect(main(admin).getByText(/올리는 중/)).toBeVisible();
		await admin.getByRole("button", { name: "memo", exact: true }).click();
		await admin.getByRole("alertdialog").getByRole("button", { name: "그만 올리고 나가기" }).click();
		await expect(admin.getByRole("alertdialog")).toBeHidden();
		await expect(main(admin).getByRole("heading", { level: 1, name: "memo" })).toBeVisible();
		release();
		await admin.goto("/#/media");
		await expect(main(admin).getByRole("heading", { level: 1 })).toBeVisible();
		await expect(main(admin).getByText(name)).toBeHidden();
		const answer = await admin.request.post("/admin/api/operations/media.query", { data: { input: { search: name } } });
		expect(((await answer.json()) as { total: number }).total).toBe(0);
	});

	test("09-1 a request that never gets an answer stays to try again, and takes no place in the queue", async ({
		admin,
	}, info) => {
		const file = await picture(admin, info.outputDir, `${unique("cut")}.jpg`);
		const ready = await picture(admin, info.outputDir, `${unique("ready")}.jpg`);
		await admin.goto("/#/media");
		await expect(main(admin).getByRole("heading", { level: 1 })).toBeVisible();
		await dropFromDisk(admin, [ready], main(admin));
		await uploadedId(admin, path.basename(ready));
		await admin.route("**/operations/media.upload", (route) => route.abort());
		await dropFromDisk(admin, [file], main(admin));
		await expect(main(admin).getByText("올리기 실패")).toBeVisible();
		const retry = main(admin).getByRole("button", { name: "다시 올리기" });
		// The button is on the picture: the tile is as tall as the file beside it, and the grid does not move.
		const tall = (name: string) => main(admin).locator("[data-slot=tile]").filter({ hasText: name }).boundingBox();
		const [cut, done, button] = await Promise.all([
			tall(path.basename(file)),
			tall(path.basename(ready)),
			retry.boundingBox(),
		]);
		expect(cut?.height).toBe(done?.height);
		expect((button?.y ?? 0) + (button?.height ?? 0)).toBeLessThan((cut?.y ?? 0) + (cut?.width ?? 0) * 0.75);
		await admin.unroute("**/operations/media.upload");
		await retry.click();
		await expect(main(admin).getByText("올리기 실패")).toBeHidden();
		await expect(tile(admin, path.basename(file))).toBeVisible();
	});

	test("09-3 undone while it goes and redone after it landed, the picture is there, and is saved", async ({
		admin,
	}, info) => {
		const file = await picture(admin, info.outputDir, `${unique("redo")}.png`);
		const post = await writing(admin);
		let release = () => {};
		const released = new Promise<void>((done) => {
			release = done;
		});
		await admin.route("**/operations/media.upload", async (route) => {
			await released;
			await route.continue();
		});
		await body(admin).getByText("글의 첫 문단이에요.").click();
		await pastePicture(admin, file);
		await expect(body(admin).getByRole("progressbar")).toBeVisible();
		await admin.keyboard.press("ControlOrMeta+Z");
		await expect(body(admin).getByRole("progressbar")).toBeHidden();
		release();
		const finished = admin.waitForResponse("**/operations/media.upload");
		await finished;
		await admin.keyboard.press("ControlOrMeta+Shift+Z");
		await expect(body(admin).getByRole("textbox", { name: "캡션" })).toBeVisible();
		await saveKeys(admin);
		const saved = (await (
			await admin.request.post("/admin/api/operations/entries.get", { data: { input: { id: post.id } } })
		).json()) as {
			entry: { doc: { blocks: { type: string }[] } };
		};
		expect(saved.entry.doc.blocks.map((block) => block.type)).toContain("image");
	});

	test("09-3 a cover going up when the property panel closes still lands in its field", async ({ admin }, info) => {
		const file = await picture(admin, info.outputDir, `${unique("cover")}.jpg`);
		const name = file.split("/").at(-1) ?? "";
		await writing(admin);
		let release = () => {};
		const released = new Promise<void>((done) => {
			release = done;
		});
		await admin.route("**/media/bytes*", async (route) => {
			await released;
			await route.continue();
		});
		await admin.getByRole("button", { name: "cover", exact: true }).click();
		const chooser = admin.waitForEvent("filechooser");
		await admin.getByRole("dialog").getByRole("button", { name: "올리기" }).click();
		await (await chooser).setFiles(file);
		const properties = admin.getByRole("button", { name: "속성" });
		await properties.click();
		release();
		await admin.waitForResponse("**/operations/media.upload");
		await properties.click();
		await expect(admin.getByRole("button", { name: "cover", exact: true })).toContainText(name);
	});

	test("09-1 a panel's changes made before someone else's rename are a conflict, not an overwrite", async ({
		admin,
	}, info) => {
		const first = await picture(admin, info.outputDir, `${unique("mine")}.jpg`);
		const name = first.split("/").at(-1) ?? "";
		await admin.goto("/#/media");
		await dropFromDisk(admin, [first], main(admin));
		await expect(tile(admin, name)).toBeVisible();
		const id = await uploadedId(admin, name);
		await admin.goto(`/#/media?file=${id}`);
		const panel = admin.getByRole("complementary");
		await panel.getByRole("textbox", { name: "파일 이름" }).fill("mine");
		await operation(admin, "media.update", { id, name: "theirs" });
		// Any write of this page reads the file again.
		await dropFromDisk(admin, [await picture(admin, info.outputDir, `${unique("other")}.jpg`)], main(admin));
		await panel.getByRole("button", { name: "저장" }).click();
		await expect(panel.getByText("다른 곳에서 먼저 바꿨어요")).toBeVisible();
		await expect(panel.getByRole("textbox", { name: "파일 이름" })).toHaveValue("theirs");
	});
});
