import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as login from "./login.stories";

const { Closed } = composeStories(login);

describe("the login screen", () => {
	it("[flow 8·04] after 'there is an admin already', the way to sign in keeps knowing it: the first-admin form never shows again", async () => {
		await Closed.run();
		await userEvent.click(page.getByRole("button", { name: "로그인하기" }));
		await expect.element(page.getByLabelText("이메일")).toBeVisible();
		await expect.element(page.getByLabelText("비밀번호 확인")).not.toBeInTheDocument();
	});
});
