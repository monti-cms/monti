import { type Browser, expect, type Page, test } from "@playwright/test";

/**
 * Flow 8, first install (docs/design/admin/flows/08-first-install.md), through the login screen of the example app with an empty database.
 * Steps 8.08 and 8.09 (GitHub only, a GitHub account that is not an admin) and 8.10 (no login method) are not here: the GitHub steps
 * need GitHub's OAuth server, and the example always has a login method.
 */

const EMAIL = "me@example.dev";
const PASSWORD = "correct-horse-battery";
const LOGIN = "/studio/login";

const field = (page: Page, label: string) => page.getByLabel(label, { exact: true });

async function fillFirstAdmin(page: Page, password: string, confirm: string) {
	await field(page, "이메일").fill(EMAIL);
	await field(page, "비밀번호").fill(password);
	await field(page, "비밀번호 확인").fill(confirm);
}

/** A second browser, signed in as nobody: a person on another computer. */
async function freshPage(browser: Browser) {
	const context = await browser.newContext();
	return context.newPage();
}

test("flow 8: 8.01 first admin form, 8.02 field errors, 8.04 created elsewhere, 8.03 created and signed in, 8.05 sign in, 8.06 wrong password, 8.07 locked", async ({
	page,
	browser,
}) => {
	await test.step("8.01 the first visit with no admin shows the first-admin form", async () => {
		await page.goto("/studio");
		await expect(page).toHaveURL(/\/studio\/login/);
		await expect(page.getByText("첫 관리자 만들기")).toBeVisible();
		// The length rule stays under the field while the password is typed.
		await expect(field(page, "비밀번호")).toHaveAccessibleDescription("10자 이상");
		await expect(page.getByRole("button", { name: "생성" })).toBeVisible();
		await expect(page.getByRole("button", { name: "GitHub로 로그인" })).toHaveCount(0);
	});

	// Opened now, before the admin exists: it still shows the form when someone else has created the admin (8.04).
	const elsewhere = await freshPage(browser);
	await elsewhere.goto(LOGIN);
	await expect(elsewhere.getByText("첫 관리자 만들기")).toBeVisible();

	await test.step("8.02 two passwords that differ are refused under the confirmation", async () => {
		await fillFirstAdmin(page, PASSWORD, `${PASSWORD}x`);
		await page.getByRole("button", { name: "생성" }).click();
		await expect(page.getByText("두 비밀번호가 같지 않아요.")).toBeVisible();
		await expect(field(page, "비밀번호 확인")).toHaveAttribute("aria-invalid", "true");
	});

	await test.step("8.02 a password under 10 characters is refused under the password", async () => {
		await fillFirstAdmin(page, "short", "short");
		// The browser refuses it first (`minlength`); without that check the server says why.
		await page.locator("input[minlength]").evaluateAll((inputs) => {
			for (const input of inputs) input.removeAttribute("minlength");
		});
		await page.getByRole("button", { name: "생성" }).click();
		await expect(page.getByText("10자 이상이어야 해요.")).toBeVisible();
		await expect(field(page, "비밀번호")).toHaveAttribute("aria-invalid", "true");
	});

	await test.step("8.03 creating the admin signs in and opens the empty list", async () => {
		await fillFirstAdmin(page, PASSWORD, PASSWORD);
		await page.getByRole("button", { name: "생성" }).click();
		await expect(page).not.toHaveURL(/\/login/);
		await expect(page.getByText("첫 글을 써 볼까요?")).toBeVisible();
	});

	await test.step("8.04 the form sent after the admin exists says so and leads to sign in", async () => {
		await fillFirstAdmin(elsewhere, "another-password-1", "another-password-1");
		await elsewhere.getByRole("button", { name: "생성" }).click();
		await expect(elsewhere.getByText("이미 관리자가 있어요.")).toBeVisible();
		await expect(field(elsewhere, "이메일")).toHaveCount(0);
		await elsewhere.getByRole("button", { name: "로그인하기" }).click();
		await expect(field(elsewhere, "이메일")).toBeVisible();
	});

	const visitor = elsewhere;
	await test.step("8.05 the sign-in screen offers the email and password and GitHub", async () => {
		await expect(field(visitor, "비밀번호")).toHaveAttribute("autocomplete", "current-password");
		await expect(visitor.getByRole("separator", { name: "또는" })).toBeVisible();
		await expect(visitor.getByRole("button", { name: "GitHub로 로그인" })).toBeVisible();
	});

	await test.step("8.06 a wrong password is refused under the password", async () => {
		await field(visitor, "이메일").fill(EMAIL);
		await field(visitor, "비밀번호").fill("wrong-password-1");
		await visitor.getByRole("button", { name: "로그인", exact: true }).click();
		await expect(visitor.getByText("이메일 또는 비밀번호가 맞지 않아요.")).toBeVisible();
		await expect(field(visitor, "비밀번호")).toHaveAttribute("aria-invalid", "true");
	});

	await test.step("8.05 the right email and password sign in", async () => {
		await field(visitor, "이메일").fill(EMAIL);
		await field(visitor, "비밀번호").fill(PASSWORD);
		await visitor.getByRole("button", { name: "로그인", exact: true }).click();
		await expect(visitor).not.toHaveURL(/\/login/);
		await expect(visitor.getByText("첫 글을 써 볼까요?")).toBeVisible();
	});

	await test.step("8.07 five misses lock the email for a minute, and the screen says to wait", async () => {
		const stranger = await freshPage(browser);
		await stranger.goto(LOGIN);
		for (let miss = 0; miss < 5; miss++) {
			await field(stranger, "이메일").fill(EMAIL);
			await field(stranger, "비밀번호").fill(`wrong-password-${miss}`);
			await stranger.getByRole("button", { name: "로그인", exact: true }).click();
			await expect(stranger.getByText("이메일 또는 비밀번호가 맞지 않아요.")).toBeVisible();
		}
		await field(stranger, "이메일").fill(EMAIL);
		await field(stranger, "비밀번호").fill(PASSWORD);
		await stranger.getByRole("button", { name: "로그인", exact: true }).click();
		await expect(stranger.getByText("1분 뒤에 다시 시도해 주세요.")).toBeVisible();
		await expect(stranger.getByRole("button", { name: "로그인", exact: true })).toBeDisabled();
	});
});
