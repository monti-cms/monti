import type { ScriptedProvider } from "@monti-cms/ai";
import type { Block, Doc } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { caretAfter, dragPath, pickWords, pointerPath } from "../../../../../testing/input";
import { scene } from "../../../test/scene";
import { assisted } from "../../assistant/assistant.stories";
import { addFile } from "../media/media.stories";
import * as blocks from "./site-blocks.stories";

/** The editor on a post with every block of `@monti-cms/blocks` (or on the body given), with its site at hand. */
const on = (doc?: Doc | null) => scene<blocks.Loaded>({ loaders: blocks.site(doc) }, blocks.default);

const body = () => page.getByRole("textbox", { name: "본문" });
const button = (name: string | RegExp) => page.getByRole("button", { name });
const save = () => userEvent.keyboard("{ControlOrMeta>}s{/ControlOrMeta}");
const saved = () =>
	expect
		.poll(() => [...document.querySelectorAll("[data-slot=status-bar-cell]")].map((cell) => cell.textContent))
		.toContain("저장됨");
/** The body as the server keeps it, after a save. */
async function kept(made: ReturnType<typeof on>): Promise<Block[]> {
	await save();
	await saved();
	const { site, id } = made.loaded();
	return ((await site.monti.run("entries.get", { id }, blocks.admin)) as { entry: { doc: Doc } }).entry.doc.blocks;
}
const find = (list: Block[], id: string) => list.find((block) => block.id === id);
const element = (type: string) => body().element().querySelector<HTMLElement>(`[data-block="${type}"]`);
/** Points at a block, as a person moves the mouse over it: its tool row comes up. */
const hover = async (type: string) => {
	const at = element(type);
	if (!at) throw new Error(`no ${type}`);
	await userEvent.hover(at);
};

describe("the site's blocks in the editor (doc 18)", () => {
	it("18-4 '/' puts a callout in; its tool row changes its kind (✓ on the current one), its title is typed in it, and undo takes the kind back", async () => {
		const made = on(null);
		await made.run();
		await userEvent.click(body());
		await userEvent.keyboard("/콜아웃");
		await userEvent.keyboard("{Enter}");
		await expect.element(body().getByRole("note")).toBeVisible();
		await userEvent.keyboard("안의 글");
		await userEvent.click(button("종류"));
		await expect.element(page.getByRole("menuitemradio", { name: "노트" })).toHaveAttribute("aria-checked", "true");
		await userEvent.click(page.getByRole("menuitemradio", { name: "위험" }));
		await expect.element(body().getByRole("note")).toHaveAttribute("data-tone", "danger");
		// Undo takes the kind back, as any change of the text.
		await userEvent.click(body().getByText("안의 글"));
		await userEvent.keyboard("{ControlOrMeta>}z{/ControlOrMeta}");
		await expect.element(body().getByRole("note")).toHaveAttribute("data-tone", "note");
		await userEvent.click(button("종류"));
		await userEvent.click(page.getByRole("menuitemradio", { name: "경고" }));
		await userEvent.click(page.getByRole("textbox", { name: "제목" }).last());
		await userEvent.keyboard("조심하세요");
		const callout = (await kept(made)).find((block) => block.type === "callout");
		expect(callout?.attrs).toEqual({ tone: "warning", title: "조심하세요" });
		expect(callout?.children?.[0]?.content).toEqual([{ type: "text", text: "안의 글" }]);
	});

	it("18-5 tabs: the + adds a tab with its name to type, ★ makes it the one shown first, and the tool row deletes it", async () => {
		const made = on();
		await made.run();
		await expect.element(body().getByText("npm install monti")).toBeVisible();
		await expect.element(body().getByText("pnpm add monti")).not.toBeVisible();
		await hover("tabs");
		await userEvent.click(page.getByRole("button", { name: "탭 더하기" }));
		const name = page.getByRole("textbox", { name: "탭 이름" });
		await expect.element(name).toHaveValue("탭 3");
		await userEvent.clear(name);
		await userEvent.type(name, "yarn");
		await userEvent.click(button("처음 열 탭"));
		let tabs = find(await kept(made), "tabs");
		expect(tabs?.children?.map((tab) => tab.attrs?.label)).toEqual(["npm", "pnpm", "yarn"]);
		expect(tabs?.attrs).toEqual({ defaultValue: "yarn" });
		await hover("tabs");
		await userEvent.click(button("탭 지우기"));
		tabs = find(await kept(made), "tabs");
		expect(tabs?.children?.map((tab) => tab.attrs?.label)).toEqual(["npm", "pnpm"]);
		// Another tab is pressed to see its words.
		await userEvent.click(page.getByRole("tab", { name: "npm" }));
		await expect.element(body().getByText("npm install monti")).toBeVisible();
		await expect.element(body().getByText("pnpm add monti")).not.toBeVisible();
	});

	it("18-5 columns: the + strip adds a column, and a column deleted from its grip's menu leaves its words in the column beside it", async () => {
		const made = on();
		await made.run();
		await hover("columns");
		await userEvent.click(page.getByRole("button", { name: "단 더하기" }));
		let columns = find(await kept(made), "columns");
		expect(columns?.children).toHaveLength(3);
		await caretAfter(body().element(), "오른쪽 단");
		await userEvent.click(page.getByRole("button", { name: "단 2", exact: true }));
		await userEvent.click(page.getByRole("menuitem", { name: "단 지우기" }));
		columns = find(await kept(made), "columns");
		expect(columns?.children).toHaveLength(2);
		expect(JSON.stringify(columns)).toContain("오른쪽 단");
	});

	it("18-4 a collapsible folds in the editor too, and its tool row's labelled toggle sets it to start open", async () => {
		const made = on();
		await made.run();
		await expect.element(body().getByText("접힌 본문")).not.toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "펼치기", exact: true }));
		await expect.element(body().getByText("접힌 본문")).toBeVisible();
		await hover("collapsible");
		const toggle = page.getByRole("button", { name: "처음부터 펼치기" });
		await expect.element(toggle).toHaveAttribute("aria-pressed", "false");
		await userEvent.click(toggle);
		await expect.element(toggle).toHaveAttribute("aria-pressed", "true");
		expect(find(await kept(made), "fold")?.attrs).toEqual({ title: "자세히", defaultOpen: true });
	});

	it("18-5 a code explorer: its tree from the paths, a file added and deleted, and the file shown first picked from the ★ menu", async () => {
		const made = on();
		await made.run();
		await expect.element(page.getByRole("treeitem", { name: /app\.ts/ })).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "db.ts", exact: true }));
		await expect.element(body().getByText("export const db = 2;")).toBeVisible();
		await expect.element(body().getByText("export const app = 1;")).not.toBeVisible();
		await userEvent.click(page.getByRole("button", { name: /^파일$/ }));
		let files = find(await kept(made), "explorer")?.children ?? [];
		expect(files.map((file) => file.attrs?.title)).toEqual(["src/app.ts", "src/db.ts", "src/new-file.ts"]);
		await hover("codeExplorer");
		await userEvent.click(button("처음 보일 파일"));
		await userEvent.click(page.getByRole("menuitemradio", { name: "src/db.ts" }));
		await userEvent.click(page.getByRole("button", { name: "new-file.ts 지우기" }));
		const explorer = find(await kept(made), "explorer");
		files = explorer?.children ?? [];
		expect(files.map((file) => file.attrs?.title)).toEqual(["src/app.ts", "src/db.ts"]);
		expect(explorer?.attrs).toEqual({ open: "src/db.ts" });
	});

	it("18-6 a formula opens its source in an area of its own under the drawing; what does not read is said under the field, and the drawing stays apart", async () => {
		const made = on();
		await made.run();
		const formula = element("math");
		if (!formula) throw new Error("no formula");
		await expect.poll(() => formula.querySelector("math")).not.toBeNull();
		await userEvent.click(formula);
		const source = page.getByRole("textbox", { name: "소스" });
		await expect.element(source).toHaveValue("a^2 + b^2 = c^2");
		await userEvent.clear(source);
		await userEvent.type(source, "\\frac{{1}{{");
		await expect.element(page.getByText(/expected/)).toBeVisible();
		await userEvent.clear(source);
		await userEvent.type(source, "E = mc^2");
		await userEvent.click(body().getByText("끝 문단"));
		expect(find(await kept(made), "math")?.attrs).toEqual({ source: "E = mc^2" });
	});

	it("18-4 '/' puts a chart in with the old sample text, drawn at once", async () => {
		const made = on(null);
		await made.run();
		await userEvent.click(body());
		await userEvent.keyboard("/차트");
		await userEvent.keyboard("{Enter}");
		await expect.poll(() => body().element().querySelector(".monti-block-chart-frame")).not.toBeNull();
		const chart = (await kept(made)).find((block) => block.type === "chart");
		expect(String(chart?.attrs?.source)).toContain("chart bar");
	});

	it("18-4 picked words get a colour from the colour card (text and background apart) and a tooltip from its card, both from the format bar's ⋯", async () => {
		const made = on();
		await made.run();
		await pickWords(body().element(), "하나씩");
		await userEvent.click(button("다른 서식"));
		await userEvent.click(page.getByRole("option", { name: "글자색" }));
		await expect.element(page.getByText("글자색")).toBeVisible();
		await expect.element(page.getByText("배경색")).toBeVisible();
		await userEvent.click(page.getByRole("button", { name: "빨강" }).first());
		// The editor draws it as the site does: its words in the colour.
		await expect
			.poll(() => body().element().querySelector('.monti-color[data-color="red"]')?.textContent)
			.toBe("하나씩");
		await pickWords(body().element(), "하나씩");
		await userEvent.click(button("다른 서식"));
		await userEvent.click(page.getByRole("option", { name: "툴팁" }));
		await expect.element(page.getByText("툴팁 넣기")).toBeVisible();
		await userEvent.type(page.getByRole("textbox", { name: "설명" }), "마지막 줄");
		await userEvent.click(page.getByRole("button", { name: "넣기" }));
		const first = find(await kept(made), "s1");
		expect(first?.content?.[1]).toMatchObject({
			text: "하나씩",
			marks: expect.arrayContaining([
				{ type: "color", color: "red" },
				{ type: "tooltip", text: "마지막 줄" },
			]),
		});
	});

	it("18-8 a change of a block's values only (a callout's kind) is a row of the review, its name line before and after", async () => {
		const made = on();
		await made.run();
		await expect.element(body()).toBeVisible();
		const { site, id } = made.loaded();
		const at = new Date();
		await site.db
			.insertInto("conversations")
			.values({ id: "c-blocks", title: "검토", created_at: at, last_opened_at: at })
			.execute();
		const proposal = await site.monti.proposals.create("c-blocks", "콜아웃을 경고로");
		const read = (await site.monti.run("entries.get", { id }, blocks.admin)) as {
			entry: { version: number; doc: Doc };
		};
		const callout = find(read.entry.doc.blocks, "callout");
		await site.monti.proposals.add(proposal, "body.edit", {
			id,
			version: read.entry.version,
			ops: [
				{ op: "setBlock", block: "callout", value: { ...callout, attrs: { tone: "warning", title: "알아 두세요" } } },
			],
		});
		window.location.hash = `#/ai/review/${proposal}`;
		await expect.element(page.getByRole("heading", { name: "제안 검토" })).toBeVisible();
		// The row is named by the block and its kind; its values before and after, the kind's names marked.
		await expect.element(page.getByText("블록 2 · 콜아웃").first()).toBeVisible();
		const line = page.getByText(/종류 /).first();
		await expect.poll(() => line.element().textContent).toMatch(/종류 ?팁 ?경고/);
	});

	it("18-4 a formula's tool row ends with the assistant's ✦: it opens the request card on that block, and the request names the whole block", async () => {
		const made = scene<blocks.Loaded & { model: ScriptedProvider }>(
			{ loaders: [assisted([]), ...blocks.site()] },
			blocks.default,
		);
		await made.run();
		const formula = element("math");
		if (!formula) throw new Error("no formula");
		await userEvent.click(formula);
		await userEvent.click(page.getByRole("button", { name: "요청" }));
		const box = page.getByRole("textbox", { name: "어시스턴트에게 요청" });
		await expect.element(box).toBeVisible();
		await userEvent.fill(box, "피타고라스 정리로 바꿔 줘");
		await userEvent.keyboard("{Enter}");
		await expect.poll(() => made.loaded().model.turns.length).toBe(1);
		const asked = JSON.stringify(made.loaded().model.turns[0]?.messages.at(-1));
		expect(asked).toContain("피타고라스 정리로 바꿔 줘");
		expect(asked).toMatch(/\\?"kind\\?":\\?"block\\?",\\?"block\\?":\\?"math\\?"/);
	});

	it("18-4 each state the stories draw comes up: a tool row with its menu, a source with its reason, the colour and tooltip cards, the review's name line", async () => {
		for (const story of [
			blocks.ToolRow,
			blocks.SourceWithError,
			blocks.ColorCard,
			blocks.TooltipCard,
			blocks.ReviewNameLine,
		])
			await scene(story, blocks.default).run();
	});

	it("18-8 a picture's name line in the review names its file, as the media field does, not its library id", async () => {
		const made = on();
		await made.run();
		await expect.element(body()).toBeVisible();
		const { site, id } = made.loaded();
		const picture = await addFile(site, { name: "cat.jpg", from: "#888", to: "#ccc", width: 320, height: 200 });
		const read = (await site.monti.run("entries.get", { id }, blocks.admin)) as {
			entry: { version: number; doc: Doc };
		};
		await site.monti.run(
			"entries.save",
			{
				id,
				version: read.entry.version,
				doc: {
					type: "doc",
					blocks: [...read.entry.doc.blocks, { id: "pic", type: "image", attrs: { media: picture, alt: "고양이" } }],
				},
			},
			blocks.admin,
		);
		const saved = (await site.monti.run("entries.get", { id }, blocks.admin)) as {
			entry: { version: number; doc: Doc };
		};
		const image = find(saved.entry.doc.blocks, "pic");
		const at = new Date();
		await site.db
			.insertInto("conversations")
			.values({ id: "c-pic", title: "검토", created_at: at, last_opened_at: at })
			.execute();
		const proposal = await site.monti.proposals.create("c-pic", "대체 텍스트");
		await site.monti.proposals.add(proposal, "body.edit", {
			id,
			version: saved.entry.version,
			ops: [{ op: "setBlock", block: "pic", value: { ...image, attrs: { ...image?.attrs, alt: "누운 고양이" } } }],
		});
		window.location.hash = `#/ai/review/${proposal}`;
		await expect.element(page.getByRole("heading", { name: "제안 검토" })).toBeVisible();
		const line = page.getByText(/파일 cat\.jpg/).first();
		await expect.element(line).toBeVisible();
		expect(line.element().textContent).not.toContain(picture);
	});

	it("18-7 a box over a paragraph and a callout picks the callout whole, its tool row stays down; Backspace takes it with its words, undo brings it back; tabs go whole too", async () => {
		const made = on();
		await made.run();
		await expect.element(body().getByText("콜아웃 본문")).toBeVisible();
		const picked = () => [...body().element().querySelectorAll<HTMLElement>("[data-picked]")];
		/** A box from the margin left of the text, from the top of one block to the bottom of another. */
		const box = async (top: Element, bottom: Element) => {
			const text = body().element().getBoundingClientRect();
			const start = { x: text.left - 56, y: top.getBoundingClientRect().top + 2 };
			await dragPath([start, { x: start.x + 120, y: bottom.getBoundingClientRect().bottom - 2 }], { steps: 10 });
		};
		const first = body().getByText("블록을 하나씩 넣은 글.").element();
		const callout = element("callout");
		if (!callout) throw new Error("no callout");
		await box(first, callout);
		// Two blocks: the paragraph and the callout, not the callout's own paragraph.
		await expect.poll(() => picked().length).toBe(2);
		expect(
			picked()[1]?.querySelector('[data-block="callout"]') ?? picked()[1]?.closest('[data-block="callout"]'),
		).not.toBeNull();
		await expect.element(page.getByRole("toolbar", { name: "콜아웃 도구" })).not.toBeInTheDocument();
		await userEvent.keyboard("{Backspace}");
		let stored = await kept(made);
		expect(find(stored, "callout")).toBeUndefined();
		expect(find(stored, "s1")).toBeUndefined();
		await userEvent.keyboard("{ControlOrMeta>}z{/ControlOrMeta}");
		await expect.element(body().getByText("콜아웃 본문")).toBeVisible();
		stored = await kept(made);
		expect(find(stored, "callout")?.children?.[0]?.content).toEqual([{ type: "text", text: "콜아웃 본문" }]);
		// Tabs, with a tab hidden: picked as one block, and taken out with both tabs.
		const tabs = element("tabs");
		if (!tabs) throw new Error("no tabs");
		await box(tabs, tabs);
		await expect.poll(() => picked().length).toBe(1);
		await userEvent.keyboard("{Backspace}");
		stored = await kept(made);
		expect(find(stored, "tabs")).toBeUndefined();
		expect(JSON.stringify(stored)).not.toContain("pnpm add monti");
	});

	it("18-7 Shift with a press on the handle of a block inside a callout picks the whole callout, from the caret's block to it", async () => {
		const made = on();
		await made.run();
		await caretAfter(body().element(), "하나씩");
		// The handle of the callout's own paragraph: the pointer over the words, then into the margin.
		const words = body().getByText("콜아웃 본문").element().getBoundingClientRect();
		await pointerPath([
			{ x: words.left + 40, y: words.top + 8 },
			{ x: words.left - 14, y: words.top + 12 },
		]);
		const handle = page.getByRole("button", { name: "블록 메뉴" });
		await expect.element(handle).toBeVisible();
		await userEvent.click(handle, { modifiers: ["Shift"] });
		const picked = () => [...body().element().querySelectorAll<HTMLElement>("[data-picked]")];
		await expect.poll(() => picked().length).toBe(2);
		expect(
			picked()[1]?.querySelector('[data-block="callout"]') ?? picked()[1]?.closest('[data-block="callout"]'),
		).not.toBeNull();
		await userEvent.keyboard("{Backspace}");
		const stored = await kept(made);
		expect(find(stored, "callout")).toBeUndefined();
		expect(find(stored, "s1")).toBeUndefined();
	});
});
