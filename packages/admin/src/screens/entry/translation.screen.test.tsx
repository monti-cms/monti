import { defineSchema } from "@monti-cms/core";
import { composeStories, composeStory } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { pointerPath, scrollsSideways, typeKorean } from "../../../../../testing/input";
import { schema } from "../story-schema";
import * as stories from "./translation.stories";

const { LanguageMenu, NewTranslation, SourceChanged, FieldsChanged, SideBySide } = composeStories(stories);

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
/** A mark in the text's left margin ("변경", "추가", "삭제"). */
const mark = (name: string) => page.getByRole("button", { name, exact: true });
const tabs = () => page.getByRole("navigation", { name: "언어" });
/** The card a mark opens says what it is about, as the banner over the text does. */
const memoCard = () => page.getByText("원문 변경", { exact: true }).last();
/** The status bar's to-do cell, whatever it counts. */
const todo = () => page.getByRole("button", { name: /^할 일/ });

/** A language's tab: its name, and "원문 변경" after it when it has a dot. */
const tab = (name: string) => tabs().getByRole("button").filter({ hasText: name });
const addLanguage = () => tabs().getByRole("button", { name: "+ 언어" });
const faint = () => body().element().querySelectorAll("[data-untranslated]").length;

/** Opens the editor at the story's entry and waits for its body. */
async function open(story: { run: () => Promise<unknown> }) {
	await story.run();
	await expect.element(body(), { timeout: 15000 }).toBeVisible();
}

/** An undecided block, by the source's words it shows as its placeholder. */
const undecided = (words: string) =>
	[...body().element().querySelectorAll<HTMLElement>("[data-source-placeholder]")].find((block) =>
		block.dataset.sourcePlaceholder?.includes(words),
	) ?? null;
/** A block of the text: an undecided one by its placeholder, another by its words. */
const blockLine = (words: string) => undecided(words) ?? body().getByText(words, { exact: false }).element();

/** The pointer moves to a block's line and presses its handle, as a hand does. */
async function blockMenu(words: string) {
	const line = blockLine(words).getBoundingClientRect();
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
		// After the languages to translate into, the way to the site's languages (editor.md).
		expect(rows.map((row) => row.element().textContent)).toEqual(["日本語ja", "언어 관리"]);
	});

	it("T92 '언어 관리' in the '+ 언어' menu goes to settings › languages", async () => {
		await open(LanguageMenu);
		await userEvent.click(page.getByRole("menuitem", { name: "언어 관리" }));
		await expect.element(page.getByRole("button", { name: "+ 언어 추가" })).toBeVisible();
		expect(window.location.hash).toBe("#/settings/languages");
	});

	it("T92 with every language already there, '+ 언어' has one row that goes to settings › languages, where a language is added", async () => {
		await open(siteOf(stories.site("all", "korean")));
		await expect.element(tab("日本語")).toBeVisible();
		await userEvent.click(addLanguage());
		const rows = await page.getByRole("menuitem").all();
		expect(rows.map((row) => row.element().textContent)).toEqual(["언어 추가 · 설정"]);
		await userEvent.click(page.getByRole("menuitem", { name: "언어 추가 · 설정" }));
		await expect.element(page.getByRole("button", { name: "+ 언어 추가" })).toBeVisible();
		expect(window.location.hash).toBe("#/settings/languages");
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
		await userEvent.click(page.getByRole("menuitem", { name: "원문 따르기" }));
		await expect.poll(faint).toBe(3);
		await expect.poll(() => document.querySelector("[data-slot=editor-margin]")?.textContent).toBe("원문 따름");

		await blockMenu("목록에는 제목과 주소");
		await userEvent.click(page.getByRole("menuitem", { name: "지우기" }));
		await expect.poll(() => undecided("목록에는 제목과 주소")).toBeNull();
		await expect.poll(faint).toBe(2);

		await userEvent.click(blockLine("편집기도 같은 원칙으로"));
		await userEvent.keyboard("Done.");
		await expect.poll(faint).toBe(1);
	});

	it("04-1 3.05 the source shows beside the translation, and side by side each source block sits on the row of its pair", async () => {
		await SideBySide.run();
		await expect
			.element(page.getByText("The editor follows the same rule", { exact: false }), { timeout: 15000 })
			.toBeVisible();
		await expect.element(page.getByRole("button", { name: "나란히" })).toHaveAttribute("aria-pressed", "true");
		// A block and its source start on one line.
		const top = (words: string) =>
			(
				page
					.getByText(words, { exact: false })
					.element()
					.closest("[data-pair=source] > div, .ProseMirror > *") as Element
			).getBoundingClientRect().top;
		expect(Math.abs(top("The editor follows the same rule") - top("편집기도 같은 원칙으로"))).toBeLessThan(2);
		expect(Math.abs(top("What I took out") - top("무엇을 덜어냈나"))).toBeLessThan(2);
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
		const block = (at instanceof Element ? at : at?.parentElement)?.closest<HTMLElement>("[data-untranslated]");
		expect(block?.dataset.sourcePlaceholder).toContain("블로그를 다시 만들기로");
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
			await userEvent.click(page.getByRole("menuitem", { name: "원문 따르기" }));
			await expect.element(page.getByRole("menuitem", { name: "원문 따르기" })).not.toBeInTheDocument();
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
		await expect.element(tab("English").getByLabelText("원문 변경")).toBeInTheDocument();
		await expect.element(tab("한국어").getByLabelText("원문 변경")).not.toBeInTheDocument();
	});

	it("04-1 3.09 the translation shows a margin mark on each changed, added and removed block, and a banner with '모두 번역 유지'", async () => {
		await open(SourceChanged);
		await expect.element(page.getByRole("button", { name: "끔" })).toHaveAttribute("aria-pressed", "true");
		await expect.element(page.getByText("원문 변경", { exact: true })).toBeVisible();
		// The to-do list holds them as a group of their own, after what stops publishing (2026-11-10, owner).
		await userEvent.click(todo());
		await expect.element(page.getByRole("group", { name: "원문 변경" })).toBeVisible();
		await userEvent.keyboard("{Escape}");
		await expect.element(mark("변경")).toBeVisible();
		await expect.element(mark("추가")).toBeVisible();
		await expect.element(mark("삭제")).toBeVisible();
		// Each mark is level with its block.
		const changed = mark("변경").element().getBoundingClientRect();
		const block = body().getByText("I rebuilt the blog", { exact: false }).element().getBoundingClientRect();
		expect(Math.abs(changed.top - block.top)).toBeLessThan(block.height);

		await userEvent.click(page.getByRole("button", { name: "모두 번역 유지" }));
		await expect.element(mark("변경")).not.toBeInTheDocument();
		await expect.element(mark("추가")).toBeVisible();
	});

	it("04-1 3.10 a mark opens the source before and after, and '번역 유지' clears that mark", async () => {
		await open(SourceChanged);
		await userEvent.click(mark("변경"));
		await expect.element(memoCard()).toBeVisible();
		await expect.element(page.getByText("글을 쓰는 시간보다 도구를 고치는 시간이", { exact: false })).toBeVisible();
		await expect.element(page.getByText("도구를 고치는 시간이 글을 쓰는 시간보다", { exact: false })).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "번역 유지", exact: true }));
		await expect.element(mark("변경")).not.toBeInTheDocument();
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

describe("writing a translation (owner review, 2026-11-06)", () => {
	it("[reach] the pointer comes from a changed block's words to its '변경' mark and presses it: the card opens, the block handle stands clear of the mark", async () => {
		await open(SourceChanged);
		const words = body().getByText("I rebuilt the blog", { exact: false }).element().getBoundingClientRect();
		const marked = mark("변경").element().getBoundingClientRect();
		const on = { x: marked.left + marked.width / 2, y: marked.top + marked.height / 2 };
		await pointerPath([{ x: words.left + 40, y: words.top + 8 }, on]);
		// The handle a pointer on the block shows is there, and what is under the pointer is still the mark.
		await expect.element(page.getByRole("button", { name: "블록 메뉴" })).toBeVisible();
		expect(document.elementFromPoint(on.x, on.y)?.closest("[data-slot=marker]")).toBe(mark("변경").element());
		await userEvent.click(mark("변경"));
		await expect.element(memoCard()).toBeVisible();
	});
	it("04-1 3.02 a new translation's undecided block is empty with the source as its placeholder: typing gives the block only the typed words", async () => {
		await open(NewTranslation);
		await expect.poll(() => undecided("블로그를 다시 만들기로")).not.toBeNull();
		const block = undecided("블로그를 다시 만들기로") as HTMLElement;
		expect(block.textContent).toBe("");
		await userEvent.click(block);
		await userEvent.keyboard("I rebuilt the blog.");
		await expect.poll(() => body().element().firstElementChild?.textContent).toBe("I rebuilt the blog.");
		expect(undecided("블로그를 다시 만들기로")).toBeNull();
		await expect.poll(faint).toBe(3);
	});

	it("[korean] Korean typed through the IME into a placeholder block is the block's only words", async () => {
		await open(NewTranslation);
		await expect.poll(() => undecided("편집기도 같은 원칙으로")).not.toBeNull();
		await userEvent.click(undecided("편집기도 같은 원칙으로") as HTMLElement);
		await typeKorean("편집");
		await expect.poll(() => body().element().children[4]?.textContent).toBe("편집");
		await expect.poll(faint).toBe(3);
	});

	it("04-1 an undecided block nobody typed in is saved still undecided, in the source's words", async () => {
		await open(NewTranslation);
		await expect.poll(() => undecided("블로그를 다시 만들기로")).not.toBeNull();
		await userEvent.click(undecided("블로그를 다시 만들기로") as HTMLElement);
		await userEvent.keyboard("I rebuilt the blog.");
		await userEvent.click(page.getByRole("button", { name: "저장", exact: true }));
		await expect.element(page.getByText("저장됨").first()).toBeVisible();
		// The saved body, shown again: the three left undecided come back as placeholders of the source's words.
		await userEvent.click(page.getByRole("button", { name: "나란히" }));
		await userEvent.click(page.getByRole("button", { name: "끔" }));
		await expect.poll(() => undecided("무엇을 덜어냈나")).not.toBeNull();
		await expect.poll(faint).toBe(3);
		await expect.element(body().getByText("I rebuilt the blog.")).toBeVisible();
	});

	it("Backspace in an untouched placeholder block leaves the block where it is", async () => {
		await open(NewTranslation);
		await expect.poll(() => undecided("무엇을 덜어냈나")).not.toBeNull();
		await userEvent.click(undecided("무엇을 덜어냈나") as HTMLElement);
		await userEvent.keyboard("{Backspace}{Backspace}");
		expect(undecided("무엇을 덜어냈나")).not.toBeNull();
		await expect.poll(faint).toBe(4);
	});

	it("04-2 3.09 a block new in the source is an undecided block marked '추가', written into at once; its card offers only '빼기'", async () => {
		await open(SourceChanged);
		await expect.poll(() => undecided("다음 글에서는 번역을 다룬다")).not.toBeNull();
		const marked = mark("추가").element().getBoundingClientRect();
		const block = (undecided("다음 글에서는 번역을 다룬다") as HTMLElement).getBoundingClientRect();
		expect(Math.abs(marked.top - block.top)).toBeLessThan(block.height);
		await userEvent.click(mark("추가"));
		await expect.element(page.getByRole("button", { name: "빼기" })).toBeVisible();
		await expect.element(page.getByRole("button", { name: "넣기" })).not.toBeInTheDocument();
		await userEvent.keyboard("{Escape}");
		await userEvent.click(undecided("다음 글에서는 번역을 다룬다") as HTMLElement);
		await userEvent.keyboard("Next comes translation.");
		await expect.element(body().getByText("Next comes translation.")).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "저장", exact: true }));
		await expect.element(page.getByText("저장됨").first()).toBeVisible();
		await expect.element(mark("추가")).not.toBeInTheDocument();
		await expect.element(body().getByText("Next comes translation.")).toBeVisible();
	});

	it("04-2 a block new in the source written in, then shown in another view before saving, is still the one block", async () => {
		await open(SourceChanged);
		await expect.poll(() => undecided("다음 글에서는 번역을 다룬다")).not.toBeNull();
		await userEvent.click(undecided("다음 글에서는 번역을 다룬다") as HTMLElement);
		await userEvent.keyboard("Next comes translation.");
		await userEvent.click(page.getByRole("button", { name: "나란히" }));
		await userEvent.click(page.getByRole("button", { name: "끔" }));
		await expect.element(body().getByText("Next comes translation.")).toBeVisible();
		expect(undecided("다음 글에서는 번역을 다룬다")).toBeNull();
		expect(body().element().children).toHaveLength(6);
	});

	it("04-2 T111 the source's new title and summary mark the translation: the tab's dot, the count, the banner, and a mark on each", async () => {
		await FieldsChanged.run();
		await expect.element(tab("English").getByLabelText("원문 변경")).toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "할 일 2" })).toBeVisible();
		const title = page.getByRole("textbox", { name: "제목" });
		await expect.poll(() => document.querySelector("[data-field-mark=title]")).not.toBeNull();
		const mark = document.querySelector("[data-field-mark=title]")?.getBoundingClientRect();
		const box = title.element().getBoundingClientRect();
		// In the margin, level with the title: as a block's mark is level with its block.
		expect(mark?.right).toBeLessThan(box.left);
		expect(mark?.top).toBeGreaterThanOrEqual(box.top);
		expect(mark?.bottom).toBeLessThanOrEqual(box.bottom);
		expect(document.querySelector("[data-field-mark=summary]")).not.toBeNull();
		// Its own words stay as they are.
		await expect.element(title).toHaveValue("The first post");
	});

	it("04-2 T111 a title's mark opens its card: before and after, and '번역 유지' clears it and keeps the words", async () => {
		await FieldsChanged.run();
		const title = page.getByRole("textbox", { name: "제목" });
		await expect.element(page.getByRole("button", { name: "할 일 2" })).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "변경", exact: true }).first());
		await expect.element(memoCard()).toBeVisible();
		await expect.element(page.getByText("고치며")).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "번역 유지", exact: true }));
		await expect.element(page.getByRole("button", { name: "할 일 1" })).toBeVisible();
		await expect.element(title).toHaveValue("The first post");
		expect(document.querySelector("[data-field-mark=title]")).toBeNull();
	});

	it("04-2 T111 writing in a marked title takes its mark away once it is saved: no '번역 유지' needed", async () => {
		await FieldsChanged.run();
		const title = page.getByRole("textbox", { name: "제목" });
		await expect.poll(() => document.querySelector("[data-field-mark=title]")).not.toBeNull();
		await userEvent.fill(title, "Fixing the first post");
		await userEvent.click(page.getByRole("button", { name: "저장", exact: true }));
		await expect.poll(() => document.querySelector("[data-field-mark=title]")).toBeNull();
		await expect.element(page.getByRole("button", { name: "할 일 1" })).toBeVisible();
		expect(document.querySelector("[data-field-mark=summary]")).not.toBeNull();
	});

	it("04-2 T111 the to-do list names the fields; a field's row opens the panel at its field, and the banner's '모두 번역 유지' clears them", async () => {
		await FieldsChanged.run();
		await userEvent.click(page.getByRole("button", { name: "할 일 2" }));
		// Nothing stops publishing, so the list is the source's changes alone.
		await expect.element(page.getByRole("dialog").getByText("원문 변경", { exact: true })).toBeVisible();
		const row = page.getByRole("button", { name: /요약/ }).first();
		await expect.element(row).toBeVisible();
		await userEvent.click(row);
		await expect.element(page.getByRole("textbox", { name: "요약" })).toHaveFocus();
		await userEvent.click(page.getByRole("button", { name: "모두 번역 유지" }));
		await expect.element(page.getByRole("button", { name: "할 일 없음" })).toBeVisible();
		await expect.element(tab("English").getByLabelText("원문 변경")).not.toBeInTheDocument();
	});

	it("04-2 T111 side by side the title's mark stands in its row", async () => {
		await FieldsChanged.run();
		await userEvent.click(page.getByRole("button", { name: "나란히" }));
		await expect.element(page.getByRole("heading", { level: 2 }).first()).toBeVisible();
		await expect.poll(() => document.querySelector("[data-field-mark=title]")).not.toBeNull();
		// In the row of the titles, in the column where a block's note is.
		const row = document.querySelector("[data-field-mark=title]")?.closest("[data-slot=compare-row]");
		expect(row?.textContent).toContain("첫 번째 글을 고치며");
	});

	it("04-2 the to-do list's '원문 변경' group has each mark's word in front and its one decision at the end; deciding one clears it", async () => {
		await open(SourceChanged);
		await userEvent.click(todo());
		const list = page.getByRole("group", { name: "원문 변경" });
		const rows = () => [...list.element().querySelectorAll("[data-slot=todo-item]")];
		// A block new in the source is a to-do above, not a row here: listed once.
		await expect.poll(() => rows().length).toBe(2);
		const rowOf = (word: string) =>
			rows().find((row) => row.querySelector("[data-slot=todo-mark]")?.textContent === word);
		const actionOf = (word: string) => [...(rowOf(word)?.querySelectorAll("button") ?? [])].at(-1)?.textContent;
		expect([actionOf("변경"), actionOf("삭제")]).toEqual(["번역 유지", "지우기"]);
		expect(rowOf("추가")).toBeUndefined();
		await userEvent.click(list.getByRole("button", { name: "번역 유지", exact: true }));
		await expect.poll(() => rows().length).toBe(1);
		await expect.element(mark("변경")).not.toBeInTheDocument();
	});

	it("04-2 '빼기' leaves a block new in the source out of this language", async () => {
		await open(SourceChanged);
		await expect.poll(() => undecided("다음 글에서는 번역을 다룬다")).not.toBeNull();
		await userEvent.click(mark("추가"));
		await userEvent.click(page.getByRole("button", { name: "빼기" }));
		await expect.element(mark("추가")).not.toBeInTheDocument();
		await expect.poll(() => undecided("다음 글에서는 번역을 다룬다")).toBeNull();
	});

	it("04-1 3.05 the cursor in a translation block marks its source block in the pane beside", async () => {
		await open(SourceChanged);
		await userEvent.click(page.getByRole("button", { name: "옆 창" }));
		const pane = page.getByRole("complementary", { name: /원문/ });
		await expect.element(pane).toBeVisible();
		await userEvent.click(body().getByText("The editor follows the same rule", { exact: false }));
		const marked = () => pane.element().querySelector("[data-slot=compare-block][data-current]")?.textContent ?? "";
		await expect.poll(marked).toContain("편집기도 같은 원칙으로");
		await userEvent.click(body().getByText("I rebuilt the blog", { exact: false }));
		await expect.poll(marked).toContain("블로그를 다시 만들기로");
	});

	it("04-1 3.05 side by side, a row's translation is written in place, and the row being written is marked on both sides", async () => {
		await SideBySide.run();
		const line = page.getByText("The editor follows the same rule", { exact: false });
		await expect.element(line, { timeout: 15000 }).toBeVisible();
		await userEvent.click(line);
		await userEvent.keyboard("{End} Done.");
		await expect.element(page.getByText("only the writing shows. Done.", { exact: false })).toBeVisible();
		const current = () => body().element().querySelector("[data-pair-current]")?.textContent ?? "";
		expect(current()).toContain("Done.");
		const source = () =>
			body().element().querySelector("[data-pair=source]:has(+ [data-pair-current])")?.textContent ?? "";
		expect(source()).toContain("편집기도 같은 원칙으로");
		await userEvent.click(page.getByRole("button", { name: "저장", exact: true }));
		await expect.element(page.getByText("저장됨").first()).toBeVisible();
	});
});
