import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import * as stories from "./document-tools.stories";

const at = (options?: Parameters<typeof stories.site>[0]) =>
	scene<{ site: StorySite }>({ loaders: stories.site(options) }, stories.default);
const more = () => page.getByRole("button", { name: "더 보기" });
const body = () => page.getByRole("textbox", { name: "본문" });
const columnWidth = () => body().element().getBoundingClientRect().width;

afterEach(() => localStorage.removeItem("monti.editor.width"));

describe("the editor's document tools (doc 14, T71)", () => {
	it("14-5 the MDX plugin's \"MDX로 보기\" is a switch in the editor's ⋯: on, the body stands beside the text as MDX and follows what is typed; off, it goes", async () => {
		await at().run();
		await userEvent.click(more());
		await userEvent.click(page.getByRole("menuitemcheckbox", { name: "MDX로 보기" }));
		await userEvent.keyboard("{Escape}");
		const pane = page.getByRole("complementary", { name: "MDX로 보기" });
		await expect.element(pane).toHaveTextContent('title: "첫 번째 글"');
		await userEvent.click(body());
		await userEvent.keyboard("{Control>}{End}{/Control}{Enter}## 새 소제목");
		await expect.element(pane).toHaveTextContent("## 새 소제목");
		// The view took the place of the properties; opening them sends it away, and the switch is off again.
		await userEvent.click(page.getByRole("button", { name: "속성" }));
		await expect.element(pane).not.toBeInTheDocument();
		await userEvent.click(more());
		await expect.element(page.getByRole("menuitemcheckbox", { name: "MDX로 보기" })).not.toBeChecked();
	});

	it("14-5 without a plugin that brings a view the ⋯ has no such row, and the body's width is still there", async () => {
		await at({ mdx: false }).run();
		await userEvent.click(more());
		await expect.element(page.getByRole("menuitem", { name: /본문 폭/ })).toBeVisible();
		await expect.element(page.getByRole("menuitemcheckbox")).not.toBeInTheDocument();
	});

	it("14-5 the body's width picked \"꽉 차게\" widens the writing column, shows as the row's value, and is the width when the editor is opened again", async () => {
		const story = at({ mdx: false });
		await story.run();
		await expect.element(body()).toBeVisible();
		const narrow = columnWidth();
		await userEvent.click(more());
		await expect.element(page.getByRole("menuitem", { name: /본문 폭/ })).toHaveTextContent("보통");
		await userEvent.click(page.getByRole("menuitem", { name: /본문 폭/ }));
		await userEvent.click(page.getByRole("menuitemradio", { name: "꽉 차게" }));
		await userEvent.keyboard("{Escape}{Escape}");
		await expect.poll(columnWidth).toBeGreaterThan(narrow);
		expect(localStorage.getItem("monti.editor.width")).toBe("full");
		await story.run();
		await expect.element(body()).toBeVisible();
		await expect.poll(columnWidth).toBeGreaterThan(narrow);
	});
});
