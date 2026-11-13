import { toast } from "@monti-cms/ui";
import { afterEach, describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import { MontiAdmin } from "../../app";
import * as plugins from "./plugins.stories";

type Loaded = { site: StorySite; id: string; checked: { id: string; text: string }[][] };
const open = (story: Parameters<typeof scene>[0]) => scene<Loaded>(story, plugins.default);
/** The same site in an admin that was handed no plugin's browser half. */
const withoutHalves = (story: Parameters<typeof scene>[0]) =>
	scene<Loaded>(story, {
		...plugins.default,
		render: (_args: unknown, { loaded }: { loaded: Loaded }) => (
			<MontiAdmin transport={loaded.site.transport} siteName="example.dev" />
		),
	});

afterEach(() => void toast.dismiss());

const tab = (name: string | RegExp) => page.getByRole("tab", { name });
const button = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
const field = (name: string) => page.getByLabelText(name, { exact: true });
const body = () => page.getByRole("textbox", { name: "본문" });
const search = () => page.getByRole("region", { name: "검색 결과" });
const share = () => page.getByRole("region", { name: "공유 카드" });
const entry = async (loaded: Loaded) =>
	(
		(await loaded.site.monti.run("entries.get", { id: loaded.id }, plugins.admin)) as {
			entry: { values: Record<string, unknown>; doc: { blocks: { content?: { text?: string }[] }[] } };
		}
	).entry;
const save = async () => {
	await userEvent.click(button("저장"));
	await expect.element(page.getByText("저장됨", { exact: true }).first()).toBeVisible();
};

describe("the assistant's proposals for a plugin's fields (doc 10 with doc 14)", () => {
	const states = async (loaded: Loaded) =>
		(await loaded.site.db.selectFrom("monti_proposal_item").select("state").orderBy("position").execute()).map(
			(item) => item.state,
		);

	it("10-1 a proposed value stands blue in the plugin's own input with its discard; the tab has the dot, the bubble walks there, the view has no mark", async () => {
		const story = open({ loaders: plugins.SeoProposed.loaders });
		await story.run();
		// On the collection's own tab: the bubble counts both, and the plugin's tab says something waits in it.
		await expect.element(page.getByText("1 / 2")).toBeVisible();
		await expect.element(tab(/SEO/)).toBeVisible();
		expect(tab(/SEO/).element().querySelector('[data-slot="change-dot"]')).not.toBeNull();
		// The bubble's step goes to the field, in its tab.
		await userEvent.click(button("다음"));
		await userEvent.click(button("이전"));
		await expect.poll(() => document.activeElement === field("SEO 제목").element()).toBe(true);
		await expect.element(field("SEO 제목")).toHaveValue("블로그를 다시 만든 까닭");
		expect(field("SEO 제목").element().hasAttribute("data-proposal")).toBe(true);
		await expect.element(button("SEO 제목 제안 버리기")).toBeVisible();
		// The plugin's switch stands as proposed, and can be discarded from its row too.
		await expect.element(page.getByRole("switch", { name: /검색에서 숨기기/ })).toBeChecked();
		await expect.element(button("검색에서 숨기기 제안 버리기")).toBeVisible();
		// The preview shows what the entry holds, not what is proposed, and has nothing of a proposal on it.
		await expect.element(search().getByText("첫 번째 글")).toBeVisible();
		expect(search().element().closest("[data-slot=field]")?.querySelector("[data-slot=label-row]") ?? null).toBeNull();
		expect(await states(story.loaded())).toEqual(["pending", "pending"]);
	});

	it("10-3 '버리기' on the row discards that one; '모두 받기' takes the other, and the save stores it and marks it applied", async () => {
		const story = open({ loaders: plugins.SeoProposed.loaders });
		await story.run();
		await userEvent.click(tab(/SEO/));
		await userEvent.click(button("검색에서 숨기기 제안 버리기"));
		await expect.element(page.getByRole("switch", { name: /검색에서 숨기기/ })).not.toBeChecked();
		await expect.element(page.getByText("1 / 1")).toBeVisible();
		await userEvent.click(button("모두 받기"));
		await expect.element(button("모두 받기")).not.toBeInTheDocument();
		expect(field("SEO 제목").element().hasAttribute("data-proposal")).toBe(false);
		// Taken, it is the entry's value in the editor: the preview follows it.
		await expect.element(search().getByText("블로그를 다시 만든 까닭")).toBeVisible();
		await save();
		const saved = await entry(story.loaded());
		expect(saved.values.seoTitle).toBe("블로그를 다시 만든 까닭");
		expect(saved.values.seoNoindex ?? null).toBeNull();
		await expect.poll(() => states(story.loaded())).toEqual(["applied", "discarded"]);
	});
});

describe("the SEO tab in the editor (T84, T75; flow 1·08)", () => {
	it("14-5 the plugin's tab stands after the collection's own, with the plugin's fields in the plugin's order", async () => {
		await open(plugins.SeoTab).run();
		const tabs = page
			.getByRole("tab")
			.elements()
			.map((each) => each.textContent);
		expect(tabs).toEqual(["기본", "SEO"]);
		const labels = [...document.querySelectorAll('[aria-label="속성"] label')].map((each) => each.textContent);
		expect(labels).toEqual(["SEO 제목", "SEO 설명", "공유 이미지", "검색에서 숨기기", "대표 주소"]);
		// The collection's own tab holds none of them.
		await userEvent.click(tab("기본"));
		await expect.element(field("요약")).toBeVisible();
		expect(await page.getByLabelText("SEO 제목").elements()).toHaveLength(0);
	});

	it("14-5 an empty title and description say which value the site uses and how long it is; the preview shows those values", async () => {
		await open(plugins.SeoTab).run();
		await expect.element(field("SEO 제목")).toHaveAttribute("placeholder", "제목과 같음 · 6/60");
		await expect.element(field("SEO 설명")).toHaveAttribute("placeholder", "요약과 같음 · 29/160");
		await expect.element(search().getByText("첫 번째 글")).toBeVisible();
		await expect.element(search().getByText("리액트로 블로그를 다시 만들며 덜어낸 것과 남긴 것.")).toBeVisible();
		await expect.element(search().getByText("example.dev › posts › first-post")).toBeVisible();
		await expect.element(share().getByText("첫 번째 글")).toBeVisible();
		// The title is the editor's own heading: typed there, the field's hint and the preview follow at once.
		await userEvent.fill(page.getByRole("textbox", { name: "제목", exact: true }), "다시 쓴 제목");
		await expect.element(field("SEO 제목")).toHaveAttribute("placeholder", "제목과 같음 · 7/60");
		await expect.element(search().getByText("다시 쓴 제목")).toBeVisible();
	});

	it("14-5 a written title shows its count beside the label and in the preview, and is saved as the entry's value; emptied, the hint is back", async () => {
		const story = open(plugins.SeoTab);
		await story.run();
		await userEvent.fill(field("SEO 제목"), "검색에 보일 제목");
		await expect.element(page.getByText("9/60")).toBeVisible();
		await expect.element(search().getByText("검색에 보일 제목")).toBeVisible();
		await expect.element(share().getByText("검색에 보일 제목")).toBeVisible();
		await save();
		expect((await entry(story.loaded())).values.seoTitle).toBe("검색에 보일 제목");

		await userEvent.clear(field("SEO 제목"));
		expect(await page.getByText("9/60").elements()).toHaveLength(0);
		await expect.element(search().getByText("첫 번째 글")).toBeVisible();
	});

	it("14-5 a title past the recommended length warns in its count and is not refused", async () => {
		const story = open(plugins.SeoWritten);
		await story.run();
		const over = page.getByText(/^\d+\/60$/);
		await expect.element(over).toBeVisible();
		const [length] = (over.element().textContent ?? "").split("/").map(Number);
		expect(length).toBeGreaterThan(60);
		expect(over.element().className).toContain("text-monti-warning");
		// The description is inside its length: its count is quiet.
		const quiet = page.getByText(/^\d+\/160$/);
		expect(quiet.element().className).not.toContain("text-monti-warning");
		await userEvent.type(field("SEO 제목"), "!");
		await save();
		expect(String((await entry(story.loaded())).values.seoTitle).endsWith("!")).toBe(true);
	});

	it("14-5 'hide from search' is a switch: on, the preview says so and the value is noindex; off, the value is gone", async () => {
		const story = open(plugins.SeoTab);
		await story.run();
		const hide = page.getByRole("switch", { name: "검색에서 숨기기" });
		await expect.element(hide).not.toBeChecked();
		await userEvent.click(hide);
		await expect.element(search().getByText("검색에서 숨김")).toBeVisible();
		await save();
		expect((await entry(story.loaded())).values.seoNoindex).toBe("noindex");
		// By the keyboard too: Space turns it off.
		hide.element().focus();
		await userEvent.keyboard(" ");
		await expect.element(hide).not.toBeChecked();
		expect(await search().getByText("검색에서 숨김").elements()).toHaveLength(0);
		await save();
		expect((await entry(story.loaded())).values).not.toHaveProperty("seoNoindex");
	});

	it("14-5 an admin handed no browser half still has the fields, with their kinds' own inputs, and no preview", async () => {
		const story = withoutHalves({ loaders: plugins.site() });
		await story.run();
		await userEvent.click(tab("SEO"));
		await expect.element(field("SEO 제목")).toBeVisible();
		await expect.element(field("SEO 제목")).toHaveAttribute("placeholder", "비어 있음");
		expect(await page.getByRole("region", { name: "검색 결과" }).elements()).toHaveLength(0);
		expect(await page.getByRole("switch").elements()).toHaveLength(0);
		await userEvent.fill(field("SEO 제목"), "기본 입력으로");
		await save();
		expect((await entry(story.loaded())).values.seoTitle).toBe("기본 입력으로");
	});
});

describe("a field of the site's own schema with an input of its own (T75)", () => {
	it("14-5 the input the field names is drawn in place of its kind's own, a switch included; a plugin is handed the chosen option's values and no other's", async () => {
		const story = open(plugins.OwnInput);
		await story.run();
		// The field is a choice of one, which its kind draws as a switch: named an input, it is drawn with that.
		const promo = page.getByRole("checkbox", { name: "promo" });
		await expect.element(promo).not.toBeChecked();
		expect(await page.getByRole("switch", { name: "promo" }).elements()).toHaveLength(0);
		await userEvent.click(promo);
		await userEvent.fill(field("promoLine"), "이번 주 추천");
		await save();
		expect((await entry(story.loaded())).values).toMatchObject({ promo: "on", promoLine: "이번 주 추천" });
		await userEvent.click(tab("값"));
		await expect.element(page.getByText(/promo=on promoLine=이번 주 추천/)).toBeVisible();
		// Turned off, the option's value is still held until the save drops it: it is not the entry's any more, and the plugin is not shown it.
		await userEvent.click(tab("기본"));
		await userEvent.click(promo);
		await userEvent.click(tab("값"));
		await expect.poll(() => page.getByText(/promoLine=/).elements().length).toBe(0);
		expect(await page.getByText(/promo=on/).elements()).toHaveLength(0);
	});
});

describe("the status bar's plugin cell (T70; flow 1·06)", () => {
	const cell = (count: number) => button(`맞춤법 ${count}`);
	/** A finding's row: the button over it that goes to its words. Its "고치기" is the row's own button, in the rows' order. */
	const row = (words: string) => page.getByRole("button", { name: new RegExp(words) });
	const fix = (nth: number) => page.getByRole("button", { name: "고치기", exact: true }).nth(nth);

	it("14-5 the cell counts what the check found; opened, each finding says what to write and has '고치기'", async () => {
		const story = open(plugins.Spelling);
		await story.run();
		// The check was handed the body's blocks as text.
		expect(
			story
				.loaded()
				.checked.at(-1)
				?.map((block) => block.text),
		).toEqual([
			"몇일 전에 블로그를 다시 만들기로 했다.",
			"목록에는 제목과 주소, 지금 상태만 남겼다.",
			"이렇게 하면 안되요 하는 말을 여러 번 들었다.",
		]);
		await userEvent.click(cell(2));
		await expect.element(row("몇일 → 며칠")).toBeVisible();
		await expect.element(row("안되요 → 안 돼요")).toBeVisible();
		await expect.element(button("모두 고치기")).toBeVisible();
	});

	it("14-5 '고치기' puts the words in the body and its row goes; '모두 고치기' fixes the rest and the cell goes; the save keeps them", async () => {
		const story = open(plugins.SpellingOpen);
		await story.run();
		await userEvent.click(fix(0));
		await expect.element(body()).toHaveTextContent(/며칠 전에 블로그를/);
		await expect.element(cell(1)).toBeVisible();
		expect(await row("몇일 → 며칠").elements()).toHaveLength(0);

		await userEvent.click(button("모두 고치기"));
		await expect.element(body()).toHaveTextContent(/이렇게 하면 안 돼요 하는 말을/);
		await expect.poll(() => page.getByRole("button", { name: /^맞춤법/ }).elements().length).toBe(0);
		await save();
		const saved = (await entry(story.loaded())).doc.blocks.map((block) => block.content?.[0]?.text);
		expect(saved).toEqual([
			"며칠 전에 블로그를 다시 만들기로 했다.",
			"목록에는 제목과 주소, 지금 상태만 남겼다.",
			"이렇게 하면 안 돼요 하는 말을 여러 번 들었다.",
		]);
	});

	it("14-5 a finding's row goes to its words in the body: they are selected", async () => {
		await open(plugins.SpellingOpen).run();
		await userEvent.click(row("안되요 → 안 돼요"));
		await expect.poll(() => window.getSelection()?.toString()).toBe("안되요");
	});

	it("14-5 a slip typed into the body is found once the body rests", async () => {
		await open(plugins.Spelling).run();
		await expect.element(cell(2)).toBeVisible();
		await userEvent.click(body());
		await userEvent.keyboard("{Control>}{End}{/Control}{Meta>}{ArrowDown}{/Meta}");
		await userEvent.keyboard(" 몇일 뒤에 다시 쓴다.");
		await expect.element(cell(3)).toBeVisible();
	});

	it("14-5 an entry in a language the check does not read has no cell, and the check is not asked", async () => {
		const story = open({ loaders: plugins.site({ locale: "en" }) });
		await story.run();
		await expect.element(body()).toBeVisible();
		await expect.element(page.getByText(/^\d+자$|characters/)).toBeVisible();
		expect(await page.getByRole("button", { name: /^맞춤법/ }).elements()).toHaveLength(0);
		expect(story.loaded().checked).toEqual([]);
	});
});

describe("the plugin's tab in the settings (doc 01, the locked tab)", () => {
	it("14-5 the tab stands after the collection's own with the plugin's fields; nothing in it is opened, added or moved, and it says whose it is", async () => {
		await open(plugins.LockedTab).run();
		await expect.element(page.getByText("seo 플러그인의 탭")).toBeVisible();
		const rows = page.getByRole("tabpanel").getByRole("listitem");
		await expect
			.poll(() => rows.elements().map((each) => each.textContent?.replace(/\s+/g, " ")))
			.toEqual([
				expect.stringContaining("seoPreview"),
				expect.stringContaining("seoTitle"),
				expect.stringContaining("seoDescription"),
				expect.stringContaining("seoImage"),
				expect.stringContaining("seoNoindex"),
				expect.stringContaining("seoCanonical"),
			]);
		expect(await page.getByRole("tabpanel").getByRole("button").elements()).toHaveLength(0);
		expect(await button("필드 추가").elements()).toHaveLength(0);
		expect(await button("묶음 추가").elements()).toHaveLength(0);
		// The collection's own tab still has its ways to add, and none of the plugin's fields.
		await userEvent.click(tab(/기본/));
		await expect.element(button("묶음 추가")).toBeVisible();
		expect(await page.getByText("seoTitle").elements()).toHaveLength(0);
	});
});

describe("the plugin's tab in the settings' preview (collections.md, the preview panel)", () => {
	it("14-5 the preview draws the plugin's fields as the editor does: the plugin's own inputs on an empty entry, and no view", async () => {
		await open(plugins.LockedTab).run();
		await userEvent.click(button("속성 패널 미리보기"));
		// The panel's own tab is named "SEO" alone; the field list's carries its count.
		await userEvent.click(page.getByRole("tab", { name: "SEO", exact: true }));
		const preview = page.getByRole("tabpanel").last();
		await expect
			.element(preview.getByLabelText("SEO 제목", { exact: true }))
			.toHaveAttribute("placeholder", "제목과 같음 · 0/60");
		await expect
			.element(preview.getByLabelText("SEO 설명", { exact: true }))
			.toHaveAttribute("placeholder", "요약과 같음 · 0/160");
		expect(preview.getByLabelText("SEO 설명", { exact: true }).element().tagName).toBe("TEXTAREA");
		await expect.element(preview.getByRole("switch", { name: "검색에서 숨기기" })).toBeVisible();
		expect(await preview.getByRole("region", { name: "검색 결과" }).elements()).toHaveLength(0);
	});
});

describe("the settings' preview from one collection to the next", () => {
	it("14-5 what was typed into a plugin's input in one collection's preview is not in the same field of another's", async () => {
		await open(plugins.LockedTab).run();
		await userEvent.click(button("속성 패널 미리보기"));
		await userEvent.click(page.getByRole("tab", { name: "SEO", exact: true }));
		const title = () => page.getByRole("tabpanel").last().getByLabelText("SEO 제목", { exact: true });
		await userEvent.fill(title(), "게시글에서 쳐 본 제목");
		await userEvent.click(page.getByRole("tabpanel").last().getByRole("switch", { name: "검색에서 숨기기" }));
		await expect.element(title()).toHaveValue("게시글에서 쳐 본 제목");
		// The other document collection has the same plugin tab, with the same fields.
		await userEvent.click(page.getByRole("main").getByRole("button", { name: /^memo/ }));
		await userEvent.click(page.getByRole("tab", { name: "SEO", exact: true }));
		await expect.element(title()).toHaveValue("");
		await expect
			.element(page.getByRole("tabpanel").last().getByRole("switch", { name: "검색에서 숨기기" }))
			.not.toBeChecked();
	});
});

describe("the plugin's list columns (T53; doc 06)", () => {
	const main = () => page.getByRole("main");

	it("14-5 'add column' offers the plugin's columns; added, the column filters by 'empty' and the list narrows", async () => {
		const story = open(plugins.ListColumns);
		await story.run();
		await story
			.loaded()
			.site.monti.run(
				"entries.save",
				{ id: story.loaded().id, version: 1, values: { seoTitle: "검색 제목" } },
				plugins.admin,
			);
		await userEvent.click(page.getByRole("menuitem", { name: "SEO 제목" }));
		const name = main().getByRole("columnheader").getByRole("button", { name: "SEO 제목", exact: true });
		await expect.element(name).toBeVisible();
		await expect.element(main().getByText("검색 제목", { exact: true })).toBeVisible();
		await userEvent.click(name);
		await userEvent.click(page.getByRole("menuitemcheckbox", { name: /비어 있음/ }));
		await userEvent.keyboard("{Escape}");
		await expect.element(main().getByText("둘째 글")).toBeVisible();
		await expect.poll(() => main().getByText("첫 번째 글").elements().length).toBe(0);
		expect(window.location.hash).toContain("seoTitle=empty");
	});
});

describe("a plugin's tool page (doc 14, toolPages)", () => {
	it("14-5 is a tab of the tools with its own address, and draws the screen the plugin's browser half brings", async () => {
		await open(plugins.ToolPage).run();
		expect(window.location.hash).toBe("#/tools/p/search/index");
		await expect.element(page.getByRole("link", { name: "검색 색인" })).toHaveAttribute("aria-current", "page");
		await expect.element(page.getByText("글 128편이 색인에 있습니다.")).toBeVisible();
		await userEvent.click(page.getByRole("link", { name: "API 키" }));
		expect(window.location.hash).toBe("#/tools/keys");
		await expect.element(page.getByRole("link", { name: "검색 색인" })).toBeVisible();
		await userEvent.click(page.getByRole("link", { name: "검색 색인" }));
		await expect.element(page.getByText("글 128편이 색인에 있습니다.")).toBeVisible();
	});

	it("14-5 an admin handed no browser half has no tab for the page", async () => {
		const story = withoutHalves({ loaders: plugins.site({ at: "tools" }) });
		await story.run();
		await expect.element(page.getByRole("link", { name: "API 키" })).toBeVisible();
		expect(await page.getByRole("link", { name: "검색 색인" }).elements()).toHaveLength(0);
	});
});
