import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import * as frame from "./frame.stories";

const { DevBypass, Fresh } = composeStories(frame);
const note = () => page.getByText("개발 서버 · 로그인 없이");

describe("the dev server's note in the sidebar", () => {
	it("16-5 let in without signing in, the sidebar's last line says why; signed in, it says nothing", async () => {
		await DevBypass.run();
		await expect.element(note()).toBeVisible();
		// Words only: nothing to press, and not in the way of the rows above it.
		expect(note().element().closest("button, a")).toBeNull();
		await userEvent.click(page.getByRole("button", { name: "설정", exact: true }));
		await expect.element(page.getByRole("heading", { name: "설정" })).toBeVisible();
		await Fresh.run();
		await expect.element(page.getByRole("navigation", { name: "관리 메뉴" })).toBeVisible();
		await expect.element(note()).not.toBeInTheDocument();
	});

	it("16-5 a folded sidebar has no room for the words: the line is not shown, and comes back unfolded", async () => {
		await DevBypass.run();
		await expect.element(note()).toBeVisible();
		await userEvent.keyboard("{Meta>}b{/Meta}");
		await expect.element(note()).not.toBeVisible();
		await userEvent.keyboard("{Meta>}b{/Meta}");
		await expect.element(note()).toBeVisible();
	});
});
