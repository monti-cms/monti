import { expect, operation, test, unique } from "./fixtures";
import { ADMIN } from "./servers";

test("the login form signs in over HTTP and the session cookie stays after a reload", async ({ page }) => {
	await page.goto("/admin");
	await page.getByLabel("이메일").fill(ADMIN.email);
	await page.getByLabel("비밀번호", { exact: true }).fill(ADMIN.password);
	await page.getByRole("button", { name: "로그인" }).click();
	const list = page.getByRole("main").getByRole("heading", { level: 1 });
	await expect(list).toBeVisible();
	await page.reload();
	await expect(list).toBeVisible();
	await expect(page.getByLabel("이메일")).toBeHidden();
});

test("an entry written in the editor is on the server after a reload", async ({ admin }) => {
	const slug = unique("first");
	const made = await operation<{ id: string }>(admin, "entries.create", {
		collection: "post",
		locale: "ko",
		title: "처음 쓰는 글",
		slug,
	});
	await admin.goto(`/admin#/c/post/${made.output.id}`);
	const title = admin.getByRole("textbox", { name: "제목" });
	await title.click();
	await admin.keyboard.press("End");
	await admin.keyboard.type(" 다시");
	await admin.keyboard.press("ControlOrMeta+S");
	await expect(admin.getByRole("button", { name: "저장 전 변경사항" })).toBeHidden();
	await admin.reload();
	await expect(title).toHaveValue("처음 쓰는 글 다시");
});
