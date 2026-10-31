import { expect, test } from "@playwright/test";

// Flow 8 (🔴): on a new site the first admin is made from the login screen, and signs in with it later. It runs on the copy with a password login and
// no login bypass (`flows/.app-login`). A wrong password, a short one or a second account are cases checked below this layer.
const EMAIL = "admin@example.test";
const PASSWORD = "flows-only-password-1";

test("AUTH-A2 the first admin is made on the login screen and signs in again", async ({ page, context }) => {
	await page.goto("/studio");
	await expect(page.getByText("첫 관리자 만들기")).toBeVisible();
	await page.getByLabel("이메일").fill(EMAIL);
	await page.getByLabel("비밀번호", { exact: true }).fill(PASSWORD);
	await page.getByLabel("비밀번호 확인").fill(PASSWORD);
	await page.getByRole("button", { name: "관리자 만들고 로그인" }).click();
	await expect(page.getByRole("button", { name: "새 글 쓰기" }).first()).toBeVisible();

	// Signed out, the screen asks for the account instead of offering a new one.
	await context.clearCookies();
	await page.goto("/studio");
	await expect(page.getByRole("button", { name: "관리자 만들고 로그인" })).toBeHidden();
	await page.getByLabel("이메일").fill(EMAIL);
	await page.getByLabel("비밀번호", { exact: true }).fill(PASSWORD);
	await page.getByRole("button", { name: "로그인", exact: true }).click();
	await expect(page.getByRole("button", { name: "새 글 쓰기" }).first()).toBeVisible();
});
