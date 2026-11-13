import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as login from "./login.stories";

const { Closed, FirstAdminErrors, Locked, Wrong } = composeStories(login);

describe("the login screen", () => {
	it("[flow 8·04] after 'there is an admin already', the way to sign in keeps knowing it: the first-admin form never shows again", async () => {
		await Closed.run();
		await userEvent.click(page.getByRole("button", { name: "로그인하기" }));
		await expect.element(page.getByLabelText("이메일")).toBeVisible();
		await expect.element(page.getByLabelText("비밀번호 확인")).not.toBeInTheDocument();
	});

	it("a line under a field is about what was sent: typed over, it goes at once and its place stays; the other fields' lines stay", async () => {
		await FirstAdminErrors.run();
		const short = page.getByText("10자 이상이어야 합니다.");
		const differ = page.getByText("두 비밀번호가 같지 않습니다.");
		await expect.element(short).toBeVisible();
		await expect.element(differ).toBeVisible();
		const button = page.getByRole("button", { name: "생성" });
		const top = button.element().getBoundingClientRect().top;
		// The second password typed over: its own line goes, the first's stays.
		await userEvent.type(page.getByLabelText("비밀번호 확인"), "x");
		await expect.element(differ).not.toBeInTheDocument();
		await expect.element(short).toBeVisible();
		await expect.element(page.getByLabelText("비밀번호 확인")).not.toHaveAttribute("aria-invalid");
		await userEvent.type(page.getByLabelText("비밀번호", { exact: true }), "x");
		await expect.element(short).not.toBeInTheDocument();
		// The lines' places are kept: nothing under them moved.
		expect(button.element().getBoundingClientRect().top).toBe(top);
	});

	it("a wrong password's line goes when the password is typed over; a lock's line stays for its minute", async () => {
		await Wrong.run();
		const wrong = page.getByText("이메일 또는 비밀번호가 맞지 않습니다.");
		await expect.element(wrong).toBeVisible();
		await userEvent.type(page.getByLabelText("비밀번호", { exact: true }), "x");
		await expect.element(wrong).not.toBeInTheDocument();

		await Locked.run();
		const field = page.getByLabelText("비밀번호", { exact: true });
		await expect.element(field).toHaveAttribute("aria-invalid", "true");
		await userEvent.type(field, "x");
		await expect.element(field).toHaveAttribute("aria-invalid", "true");
	});
});
