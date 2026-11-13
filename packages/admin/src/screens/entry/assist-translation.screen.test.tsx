import type { ScriptedProvider } from "@monti-cms/ai";
import type { Doc } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { pointerPath } from "../../../../../testing/input";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import { assisted } from "../../assistant/assistant.stories";
import { admin } from "./entry.stories";
import * as stories from "./translation.stories";

/**
 * The assistant in a translation (doc 10, item 19; T94): "✦ translate" for the blocks still in the source's words, "✦ translate" for one
 * block from its menu, and "✦ translate again" on a block whose source changed. The model is the scripted one.
 */
type Loaded = { site: StorySite; ids: Record<string, string>; model: ScriptedProvider };
const GROUP = "_group";

const on = (kind: Parameters<typeof stories.site>[0], assistantOn = true) =>
	scene<Loaded>({ loaders: [...(assistantOn ? [assisted()] : []), ...stories.site(kind, "english")] }, stories.default);
const body = () => page.getByRole("textbox", { name: "본문" });
const button = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
/** "✦ translate" by the language tabs: the assistant's blue text button (the bubble's name is a button of the same word). */
const translate = () =>
	[...document.querySelectorAll<HTMLElement>("[data-slot=text-button][data-tone=proposal]")].filter(
		(each) => each.textContent === "번역",
	);
/** The proposal bubble's name: the request the proposals came from. */
const bubbleName = () =>
	document.querySelector("[data-slot=proposal-bubble] [data-slot=text-button]")?.textContent ?? null;
const faint = () => body().element().querySelectorAll("[data-untranslated]").length;
const filled = () =>
	[...body().element().querySelectorAll<HTMLElement>("[data-proposal-fill]")].map((block) => block.textContent);
const english = async ({ site, ids }: Loaded) =>
	((await site.monti.run("entries.get", { id: ids.english }, admin)) as { entry: { doc: Doc; version: number } }).entry;

async function open(story: { run: () => Promise<unknown> }) {
	await story.run();
	await expect.element(body(), { timeout: 15000 }).toBeVisible();
}
/** An undecided block, by the source's words it shows as its placeholder. */
const undecided = (words: string) =>
	[...body().element().querySelectorAll<HTMLElement>("[data-source-placeholder]")].find((block) =>
		block.dataset.sourcePlaceholder?.includes(words),
	) ?? null;
async function blockMenu(words: string) {
	const line = undecided(words) ?? body().getByText(words, { exact: false }).element();
	const box = line.getBoundingClientRect();
	await pointerPath([{ x: box.left + 8, y: box.top + 8 }]);
	await userEvent.click(page.getByRole("button", { name: "블록 메뉴" }));
}

const ENGLISH: Record<string, string> = {
	"블로그를 다시": "I rebuilt the blog because fixing the tool took longer than writing.",
	"무엇을 덜어냈나": "What I took out",
	목록에는: "The list keeps only the title, the address and the state.",
	편집기도: "The editor follows the same rule.",
};
/** One `body_edit` per undecided block the model was asked for: its words put in the block's place. */
const translating = (made: { loaded: () => Loaded }, only?: (words: string) => boolean) => async () => {
	const read = await english(made.loaded());
	const calls = read.doc.blocks.flatMap((block) => {
		const words = (block.content ?? []).map((part) => ("text" in part ? part.text : "")).join("");
		const to = Object.entries(ENGLISH).find(([start]) => words.startsWith(start))?.[1];
		if (!to || block.link?.state !== "pending" || (only && !only(words))) return [];
		return [
			{
				name: "body_edit",
				input: {
					id: made.loaded().ids.english,
					version: read.version,
					ops: [{ op: "replaceText", block: block.id, from: 0, to: words.length, text: to }],
					[GROUP]: "번역",
				},
			},
		];
	});
	return { calls };
};

describe("a translation: '✦ translate' (T94; doc 10, item 19)", () => {
	it("10-1 [flow 3·03] '번역' by the tabs, while blocks are still in the source's words, asks without opening the panel; each translation comes in blue where the block's words will stand", async () => {
		const made = on("new");
		await open(made);
		made.loaded().model.add(translating(made), { text: "네 문단을 번역했습니다." });
		await expect.poll(faint).toBe(4);
		await expect.poll(translate).toHaveLength(1);
		await userEvent.click(translate()[0] as HTMLElement);
		// The panel stays closed: the request is the button's own.
		await expect.element(page.getByRole("complementary", { name: "어시스턴트" })).not.toBeInTheDocument();
		await expect
			.poll(filled)
			.toEqual([
				"I rebuilt the blog because fixing the tool took longer than writing.",
				"What I took out",
				"The list keeps only the title, the address and the state.",
				"The editor follows the same rule.",
			]);
		// The source's words gave way to the proposed ones, which are not the block's yet: nothing is changed.
		expect(body().element().querySelectorAll("[data-source-placeholder]")).toHaveLength(0);
		expect((await english(made.loaded())).version).toBe(1);
		// The bubble is named by the button, and walks the four.
		await expect.poll(translate).toHaveLength(0);
		await expect.element(page.getByText("1 / 4")).toBeVisible();
		expect(bubbleName()).toBe("번역");
		// The model was told what the button means, apart from the two words of the request.
		const asked = JSON.stringify(made.loaded().model.turns[0]?.messages.at(-1));
		expect(asked).toContain("translate button");
		expect(asked).toContain('\\"task\\":\\"translate\\"');
	});

	it("10-3 [flow 3·03] taking the translations writes them into the blocks, unsaved; saved, the blocks are translated and none is in the source's words", async () => {
		const made = on("new");
		await open(made);
		made.loaded().model.add(translating(made), { text: "번역했습니다." });
		await expect.poll(translate).toHaveLength(1);
		await userEvent.click(translate()[0] as HTMLElement);
		await expect.poll(() => filled().length).toBe(4);
		await userEvent.click(button("모두 받기"));
		await expect.poll(filled).toEqual([]);
		await expect.poll(faint).toBe(0);
		expect(body().element().textContent).toContain("What I took out");
		await userEvent.keyboard("{Meta>}s{/Meta}");
		await expect
			.poll(async () => (await english(made.loaded())).doc.blocks.map((block) => block.link?.state))
			.toEqual(["translated", "translated", "translated", "followSource", "translated"]);
		const items = await made.loaded().site.db.selectFrom("monti_proposal_item").select("state").execute();
		expect(items.map((item) => item.state)).toEqual(["applied", "applied", "applied", "applied"]);
	});

	it("10-1 the dimmed block's menu has '번역' for that block alone: the model is asked for it and no other, and the others stay undecided", async () => {
		const made = on("new");
		await open(made);
		made.loaded().model.add(
			translating(made, (words) => words.startsWith("무엇을")),
			{ text: "제목을 번역했습니다." },
		);
		await blockMenu("무엇을 덜어냈나");
		await userEvent.click(page.getByRole("menuitem", { name: "번역" }));
		await expect.poll(filled).toEqual(["What I took out"]);
		const read = await english(made.loaded());
		const heading = read.doc.blocks[1]?.id;
		expect(JSON.stringify(made.loaded().model.turns[0]?.messages.at(-1))).toContain(`\\"blocks\\":[\\"${heading}\\"]`);
		// The other three are still undecided, and "번역" still stands for them.
		expect(body().element().querySelectorAll("[data-source-placeholder]")).toHaveLength(3);
		await expect.poll(translate).toHaveLength(1);
	});

	it("10-1 [flow 3·11] the card of a block whose source changed has '다시 번역': the model is asked for that block again, and the bubble says '다시 번역'", async () => {
		const made = on("changed");
		await open(made);
		const read = await english(made.loaded());
		const first = read.doc.blocks[0];
		const words = (first?.content ?? []).map((part) => ("text" in part ? part.text : "")).join("");
		made.loaded().model.add(
			{
				calls: [
					{
						name: "body_edit",
						input: {
							id: made.loaded().ids.english,
							version: read.version,
							ops: [
								{
									op: "replaceText",
									block: first?.id,
									from: 0,
									to: words.length,
									text: "I rebuilt the blog: the tool took more time than the writing.",
								},
							],
							[GROUP]: "다시 번역",
						},
					},
				],
			},
			{ text: "다시 번역했습니다." },
		);
		await userEvent.click(page.getByRole("button", { name: "변경", exact: true }).first());
		await expect.element(button("번역 유지")).toBeVisible();
		await userEvent.click(button("다시 번역"));
		await expect
			.poll(() => [...body().element().querySelectorAll("ins")].map((each) => each.textContent).join(""))
			.toContain("the tool took more time");
		await expect.poll(bubbleName).toBe("다시 번역");
		const asked = JSON.stringify(made.loaded().model.turns[0]?.messages.at(-1));
		expect(asked).toContain('\\"task\\":\\"retranslate\\"');
		expect(asked).toContain(`\\"blocks\\":[\\"${first?.id}\\"]`);
	});

	it("10-1 several changes of one undecided block's words are one filling of it: drawn once, and taken as the block's whole translation", async () => {
		const made = on("new");
		await open(made);
		const read = await english(made.loaded());
		const heading = read.doc.blocks[1];
		const words = (heading?.content ?? []).map((part) => ("text" in part ? part.text : "")).join("");
		made.loaded().model.add(
			{
				calls: [
					{
						name: "body_edit",
						input: {
							id: made.loaded().ids.english,
							version: read.version,
							ops: [
								{ op: "replaceText", block: heading?.id, from: 0, to: words.length, text: "What" },
								{ op: "replaceText", block: heading?.id, from: 4, to: 4, text: " I took out" },
							],
							[GROUP]: "번역",
						},
					},
				],
			},
			{ text: "제목을 번역했습니다." },
		);
		await blockMenu("무엇을 덜어냈나");
		await userEvent.click(page.getByRole("menuitem", { name: "번역" }));
		await expect.poll(filled).toEqual(["What I took out"]);
		await userEvent.click(button("모두 받기"));
		await expect.poll(filled).toEqual([]);
		await expect.poll(() => body().element().querySelector("h2")?.textContent).toBe("What I took out");
	});

	it("10-1 a site without the assistant has no '번역' by the tabs, in the block menu or on the change's card", async () => {
		const plain = on("new", false);
		await open(plain);
		await expect.poll(faint).toBe(4);
		expect(translate()).toHaveLength(0);
		await blockMenu("무엇을 덜어냈나");
		await expect.element(page.getByRole("menuitem", { name: "원문 따르기" })).toBeVisible();
		await expect.element(page.getByRole("menuitem", { name: "번역" })).not.toBeInTheDocument();
	});
});
