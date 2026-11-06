import { defineSchema } from "@monti-cms/core";
import { composeStories, composeStory } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { pointerPath, scrollsSideways } from "../../../../../testing/input";
import { schema } from "../story-schema";
import * as stories from "./translation.stories";

const { LanguageMenu, NewTranslation, SourceChanged, SideBySide } = composeStories(stories);

/** The editor opened on a site made another way, with nothing done to it. */
const siteOf = (loaders: unknown) =>
	composeStory({ ...stories.LanguageMenu, loaders, play: undefined } as typeof stories.LanguageMenu, stories.default);

const fiveLanguages = defineSchema({
	...schema,
	locales: {
		...schema.locales,
		list: [
			...schema.locales.list,
			{ code: "zh-Hant", name: "繁體中文" },
			{ code: "pt-BR", name: "Português (Brasil)" },
		],
	},
});
const oneLanguage = defineSchema({
	...schema,
	locales: { source: "ko", list: [{ code: "ko", name: "한국어" }], prefix: "never" },
});

const body = () => page.getByRole("textbox", { name: "본문" });
/** A mark in the text's left margin ("바뀜", "새로", "지워짐"). */
const mark = (name: string) => page.getByRole("button", { name, exact: true });
const tabs = () => page.getByRole("navigation", { name: "언어" });
/** A language's tab: its name, and "원문이 바뀜" after it when it has a dot. */
const tab = (name: string) => tabs().getByRole("button").filter({ hasText: name });
const addLanguage = () => tabs().getByRole("button", { name: "+ 언어" });
const faint = () => body().element().querySelectorAll("[data-untranslated]").length;

/** Opens the editor at the story's entry and waits for its body. */
async function open(story: { run: () => Promise<unknown> }) {
	await story.run();
	await expect.element(body(), { timeout: 15000 }).toBeVisible();
}

/** The pointer moves to a block's line and presses its handle, as a hand does. */
async function blockMenu(words: string) {
	const line = body().getByText(words, { exact: false }).element().getBoundingClientRect();
	await pointerPath([
		{ x: line.left + 40, y: line.top + 8 },
		{ x: line.left - 20, y: line.top + 8 },
	]);
	await userEvent.click(page.getByRole("button", { name: "블록 메뉴" }));
}

describe("the language tabs", () => {
	it("[overflow-after-add] with five languages the tabs and '+ 언어' still fit the writing column, and nothing scrolls sideways", async () => {
		await open(siteOf(stories.site("all", "korean", fiveLanguages)));
		await expect.element(tab("Português (Brasil)")).toBeVisible();
		const column = body().element().getBoundingClientRect();
		const row = tabs().element().getBoundingClientRect();
		expect(row.left).toBeGreaterThanOrEqual(column.left - 1);
		expect(row.right).toBeLessThanOrEqual(column.right + 1);
		expect(scrollsSideways(tabs().element())).toEqual([]);
	});

	it("T68 an entry of a two-language site shows its languages as tabs, its own pressed, and '+ 언어' after them", async () => {
		await open(LanguageMenu);
		await expect.element(page.getByRole("menuitem", { name: /日本語/ })).toBeVisible();
		await userEvent.keyboard("{Escape}");
		await expect.element(tab("한국어")).toHaveAttribute("aria-current", "page");
		await expect.element(tab("English")).not.toHaveAttribute("aria-current");
		await expect.element(addLanguage()).toBeVisible();
	});

	it("T68 a tab opens that language's entry of the group", async () => {
		await open(LanguageMenu);
		await userEvent.keyboard("{Escape}");
		await userEvent.click(tab("English"));
		await expect.element(tab("English")).toHaveAttribute("aria-current", "page");
		await expect.element(page.getByRole("textbox", { name: "제목" })).toHaveValue("The first post");
		await expect.element(page.getByText("/en/posts/first-post")).toBeVisible();
	});

	it("T68 a one-language site's editor has no language tabs", async () => {
		await open(siteOf(stories.site("alone", "korean", oneLanguage)));
		await expect.element(tabs()).not.toBeInTheDocument();
	});
});

describe("flow 3, a translation", () => {
	it("04-1 3.01 '+ 언어' lists the languages the group lacks, each with its code", async () => {
		await open(LanguageMenu);
		await expect.element(page.getByRole("menuitem").first()).toBeVisible();
		const rows = await page.getByRole("menuitem").all();
		expect(rows.map((row) => row.element().textContent)).toEqual(["日本語ja"]);
	});

	it("T68 with every language already there, '+ 언어' is not offered: adding a language is the settings' (T92)", async () => {
		await open(siteOf(stories.site("all", "korean")));
		await expect.element(tab("日本語")).toBeVisible();
		await expect.element(addLanguage()).not.toBeInTheDocument();
	});

	it("04-1 3.02 picking a language opens the new translation: every block faint, the address copied, one to-do open", async () => {
		await open(LanguageMenu);
		await userEvent.click(page.getByRole("menuitem", { name: /日本語/ }));
		await expect.element(tab("日本語")).toHaveAttribute("aria-current", "page");
		await expect.element(page.getByText("/ja/posts/first-post")).toBeVisible();
		// Four blocks with words, faint; the code follows the source.
		await expect.poll(faint).toBe(4);
		await expect.element(page.getByRole("button", { name: /할 일 5/ })).toBeVisible();
	});

	it("04-1 3.04 a faint block's menu keeps it in the source's words or removes it; typing into it translates it", async () => {
		await open(NewTranslation);
		await expect.poll(faint).toBe(4);
		await blockMenu("무엇을 덜어냈나");
		await userEvent.click(page.getByRole("menuitem", { name: "원문 유지" }));
		await expect.poll(faint).toBe(3);
		await expect.poll(() => document.querySelector("[data-slot=editor-margin]")?.textContent).toBe("원문");

		await blockMenu("목록에는 제목과 주소");
		await userEvent.click(page.getByRole("menuitem", { name: "지우기" }));
		await expect.element(body().getByText("목록에는 제목과 주소", { exact: false })).not.toBeInTheDocument();
		await expect.poll(faint).toBe(2);

		await userEvent.click(body().getByText("편집기도 같은 원칙으로", { exact: false }));
		await userEvent.keyboard("{End} Done.");
		await expect.poll(faint).toBe(1);
	});

	it("04-1 3.05 the source shows beside the translation, and side by side each source block sits on the row of its pair", async () => {
		await SideBySide.run();
		await expect
			.element(page.getByText("The editor follows the same rule", { exact: false }), { timeout: 15000 })
			.toBeVisible();
		await expect.element(page.getByRole("button", { name: "나란히" })).toHaveAttribute("aria-pressed", "true");
		const row = (words: string) => page.getByText(words, { exact: false }).element().closest("[data-slot=compare-row]");
		expect(row("The editor follows the same rule")).toBe(row("편집기도 같은 원칙으로"));
		expect(row("What I took out")).toBe(row("무엇을 덜어냈나"));
		// The new source block has a row of its own, noted.
		await expect.element(page.getByText("다음 글에서는 번역을 다룬다.").first()).toBeVisible();
	});

	it("04-1 3.06 publishing with a faint block left is refused, and the to-do row moves to that block", async () => {
		await open(NewTranslation);
		await userEvent.click(page.getByRole("button", { name: "발행하기" }));
		const pending = page.getByRole("button", { name: /흐린 블록/ }).first();
		await expect.element(pending).toBeVisible();
		await userEvent.click(pending);
		const at = window.getSelection()?.anchorNode;
		const block = (at instanceof Element ? at : at?.parentElement)?.closest("[data-untranslated]");
		expect(block?.textContent).toContain("블로그를 다시 만들기로");
	});

	it("04-1 3.07 with every block decided the translation publishes under /en/…", async () => {
		await open(NewTranslation);
		for (const words of [
			"블로그를 다시 만들기로",
			"무엇을 덜어냈나",
			"목록에는 제목과 주소",
			"편집기도 같은 원칙으로",
		]) {
			await blockMenu(words);
			await userEvent.click(page.getByRole("menuitem", { name: "원문 유지" }));
			await expect.element(page.getByRole("menuitem", { name: "원문 유지" })).not.toBeInTheDocument();
		}
		await userEvent.click(page.getByRole("textbox", { name: "제목" }));
		await userEvent.keyboard("The first post");
		await userEvent.click(page.getByRole("button", { name: "발행하기" }));
		await expect.element(page.getByText("발행됨").first()).toBeVisible();
		await expect.element(page.getByText("/en/posts/first-post")).toBeVisible();
	});

	it("04-1 3.08 after the source is published again, the English tab has a dot", async () => {
		await open(LanguageMenu);
		await userEvent.keyboard("{Escape}");
		await expect.element(tab("English").getByLabelText("원문이 바뀜")).toBeInTheDocument();
		await expect.element(tab("한국어").getByLabelText("원문이 바뀜")).not.toBeInTheDocument();
	});

	it("04-1 3.09 the translation shows a margin mark on each changed, added and removed block, and a banner with '모두 확인'", async () => {
		await open(SourceChanged);
		await expect.element(page.getByRole("button", { name: "끔" })).toHaveAttribute("aria-pressed", "true");
		await expect.element(page.getByText("원문이 바뀌었어요")).toBeVisible();
		// The status bar counts them in a cell of its own, apart from the to-do list.
		await expect.element(page.getByRole("button", { name: "원문 바뀜 3" })).toBeVisible();
		await expect.element(mark("바뀜")).toBeVisible();
		await expect.element(mark("새로")).toBeVisible();
		await expect.element(mark("지워짐")).toBeVisible();
		// Each mark is level with its block.
		const changed = mark("바뀜").element().getBoundingClientRect();
		const block = body().getByText("I rebuilt the blog", { exact: false }).element().getBoundingClientRect();
		expect(Math.abs(changed.top - block.top)).toBeLessThan(block.height);

		await userEvent.click(page.getByRole("button", { name: "모두 확인" }));
		await expect.element(mark("바뀜")).not.toBeInTheDocument();
		await expect.element(mark("새로")).toBeVisible();
	});

	it("04-1 3.10 a mark opens the source before and after, and '확인' clears that mark", async () => {
		await open(SourceChanged);
		await userEvent.click(mark("바뀜"));
		const card = page.getByText("원문 바뀜", { exact: true });
		await expect.element(card).toBeVisible();
		await expect.element(page.getByText("글을 쓰는 시간보다 도구를 고치는 시간이", { exact: false })).toBeVisible();
		await expect.element(page.getByText("도구를 고치는 시간이 글을 쓰는 시간보다", { exact: false })).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "확인", exact: true }));
		await expect.element(mark("바뀜")).not.toBeInTheDocument();
		await expect.element(body().getByText("I rebuilt the blog", { exact: false })).toBeVisible();
	});

	it("04-5 a 'same' field shows the source's value as text in the translation's properties, with no input", async () => {
		await open(SourceChanged);
		await userEvent.click(page.getByRole("button", { name: "속성" }));
		await expect.element(page.getByText("도구보다 글")).toBeVisible();
		await expect.element(page.getByRole("textbox", { name: "부제" })).not.toBeInTheDocument();
		await expect
			.element(page.getByRole("textbox", { name: "요약" }))
			.toHaveValue("What I took out of the blog, and what I kept.");
	});
});
