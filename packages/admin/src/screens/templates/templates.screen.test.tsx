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

	it("a block still in hand when the screen goes away is let go: a pointer that moves afterwards reaches no editor", async () => {
		const thrown: string[] = [];
		const onError = (event: ErrorEvent) => thrown.push(event.message);
		window.addEventListener("error", onError);
		try {
			await scene(templates.Dragging, templates.default).run();
			await expect.element(page.getByText("서론").last()).toBeVisible();
			// Another screen: the editor with the block in hand is gone.
			await scene(templates.NoTemplates, templates.default).run();
			await expect.element(text()).not.toBeInTheDocument();
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: 400, clientY: 300 }));
			expect(thrown).toEqual([]);
		} finally {
			window.removeEventListener("error", onError);
		}
	});
});

describe("the template editor: before the template is there", () => {
	it("03 T153 nothing of the template can be changed before it is read: no name to type into and no save, and the saved name comes with nothing counted as changed", async () => {
		const held = { release: () => {} };
		const gate = new Promise<void>((done) => {
			held.release = done;
		});
		const loaders = ([] as (() => Promise<{ site: StorySite }>)[]).concat(
			templates.TemplateEditor.loaders as (() => Promise<{ site: StorySite }>)[],
		);
		const story = scene<{ site: StorySite }>(
			{
				// The story's own steps wait for the body: here the read is held.
				loaders: loaders.map((load) => async () => {
					const loaded = await load();
					const { transport } = loaded.site;
					loaded.site.transport = async (name, input, options) => {
						if (name === "templates.get") await gate;
						return transport(name, input, options);
					};
					return loaded;
				}),
			},
			templates.default,
		);
		await story.run();
		// From the tools, as a person opens it.
		await userEvent.click(button("도구"));
		await userEvent.click(button("기본 글"));
		// The screen is drawn (its way back), the template is not read yet.
		await expect.element(page.getByRole("button", { name: "템플릿", exact: true })).toBeVisible();
		const name = () => page.getByRole("textbox", { name: "템플릿 이름" });
		expect(name().elements()).toEqual([]);
		expect(page.getByRole("button", { name: "저장", exact: true }).elements()).toEqual([]);
		// No status bar for a template that is not read yet, as in the entry editor.
		expect(document.querySelector("[data-slot=status-bar]")).toBeNull();
		await userEvent.keyboard("먼저 친 글자");
		held.release();
		await expect.element(name()).toHaveValue("기본 글");
		await expect.element(page.getByText("저장 안 됨")).not.toBeInTheDocument();
		await expect.element(page.getByRole("button", { name: "저장", exact: true })).toBeVisible();
		expect(document.querySelector("[data-slot=status-bar]")).not.toBeNull();
	});

	it("03 T153 the stories of it: before the read the way back alone, and a read that failed says so with its way to try again", async () => {
		await scene<{ site: StorySite }>(templates.EditorBeforeTheRead, templates.default).run();
		await expect.element(page.getByRole("button", { name: "템플릿", exact: true })).toBeVisible();
		expect(page.getByRole("textbox", { name: "템플릿 이름" }).elements()).toEqual([]);

		await scene<{ site: StorySite }>(templates.EditorReadFailed, templates.default).run();
		await expect.element(page.getByText("템플릿을 불러오지 못했습니다")).toBeVisible();
		await expect.element(button("다시 시도")).toBeVisible();
		expect(page.getByRole("textbox", { name: "템플릿 이름" }).elements()).toEqual([]);
		expect(page.getByRole("button", { name: "저장", exact: true }).elements()).toEqual([]);
	});
});
