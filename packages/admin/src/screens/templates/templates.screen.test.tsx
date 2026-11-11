import type { Doc } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { caretAfter, pickWords } from "../../../../../testing/input";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import * as templates from "./templates.stories";

/** "기본 글" open in the template editor, with its site at hand. */
const editor = () => scene<{ site: StorySite }>(templates.TemplateEditor, templates.default);

const text = () => page.getByRole("textbox", { name: "본문" });
const button = (name: string) => page.getByRole("button", { name });
const formatted = (selector: string) => text().element().querySelector(selector);

describe("the template editor", () => {
	it("[flow 1·02] [line-start] '/' typed at the start of a new line opens the block menu", async () => {
		await editor().run();
		await caretAfter(text().element(), "한 줄 요약과 다음에 읽을 글.");
		await userEvent.keyboard("{Enter}/");
		await expect.element(page.getByRole("listbox", { name: "블록" })).toBeVisible();
	});

	it("'서식 지우기' is on the format card only while the picked words have a format, and one press takes them all off", async () => {
		await editor().run();
		await pickWords(text().element(), "무엇을 다루는지");
		await expect.element(page.getByRole("toolbar", { name: "서식" })).toBeVisible();
		await expect.element(button("서식 지우기")).not.toBeInTheDocument();
		await userEvent.click(button("굵게"));
		await userEvent.click(button("기울임"));
		// A wider pick that holds the formatted words still offers it.
		await pickWords(text().element(), "이 글에서 무엇을 다루는지 한두");
		await userEvent.click(button("서식 지우기"));
		await expect.poll(() => formatted("strong, em")).toBeNull();
		await expect.element(button("서식 지우기")).not.toBeInTheDocument();
	});

	it("⌘\\ with the caret inside formatted words, nothing picked: that run of formats comes off", async () => {
		await editor().run();
		await pickWords(text().element(), "무엇을 다루는지");
		await userEvent.click(button("굵게"));
		await expect.poll(() => formatted("strong")).not.toBeNull();
		await caretAfter(text().element(), "무엇을 다루");
		// The editor's Mod: ⌘ on a Mac, Ctrl elsewhere (CI).
		await userEvent.keyboard("{ControlOrMeta>}\\{/ControlOrMeta}");
		await expect.poll(() => formatted("strong")).toBeNull();
	});

	it("a template saved elsewhere since it was opened: the save is refused and says so, and the change stays unsaved", async () => {
		const story = editor();
		await story.run();
		const { monti } = story.loaded().site;
		const [first] = (await monti.run("templates.list", {}, templates.admin)) as { id: string; version: number }[];
		const saved = (await monti.run("templates.get", { id: first?.id }, templates.admin)) as { doc: Doc };
		await monti.run(
			"templates.save",
			{ id: first?.id, version: first?.version, name: "기본 글 (다른 탭)", doc: saved.doc },
			templates.admin,
		);
		await userEvent.fill(page.getByRole("textbox", { name: "템플릿 이름" }), "기본 글 고침");
		await userEvent.click(button("저장"));
		await expect.element(page.getByText("다른 곳에서 먼저 저장했습니다")).toBeVisible();
		await expect.element(page.getByText("저장 안 됨")).toBeVisible();
	});
});
