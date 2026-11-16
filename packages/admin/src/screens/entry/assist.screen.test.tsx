import { ProviderError, type ScriptedProvider } from "@monti-cms/ai";
import { type Block, type Doc, plainText } from "@monti-cms/core";
import { describe, expect, it, vi } from "vitest";
import { page, userEvent } from "vitest/browser";
import { pickWords } from "../../../../../testing/input";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import { assisted } from "../../assistant/assistant.stories";
import * as assist from "./assist.stories";
import * as entry from "./entry.stories";

/**
 * The assistant's entry points in the entry editor (doc 10; T41, T64, T69): "✦ fill" on a field, "✦ request" on picked words, one
 * proposed change's own card. The model is the scripted one: it says what each test tells it to.
 */
type Loaded = { site: StorySite; id: string; model: ScriptedProvider };
type Script = Parameters<typeof assisted>[0];
type Answer = Parameters<typeof assisted>[1];

/** The editor on an entry of this kind, on a site that has the assistant. */
const on = (
	kind: Parameters<typeof entry.site>[0],
	script: Script = [],
	answer?: Answer,
	options?: { key?: boolean },
) => scene<Loaded>({ loaders: [assisted(script, answer, options), ...entry.site(kind)] }, entry.default);

const title = () => page.getByRole("textbox", { name: "제목" });
const body = () => page.getByRole("textbox", { name: "본문" });
const button = (name: string | RegExp) => page.getByRole("button", { name, exact: typeof name === "string" });
const summary = () => page.getByRole("textbox", { name: "요약" });
const subtitle = () => page.getByRole("textbox", { name: "부제" });
const saveCell = (text: string) =>
	expect
		.poll(() => [...document.querySelectorAll("[data-slot=status-bar-cell]")].map((cell) => cell.textContent))
		.toContain(text);
async function opened() {
	await expect.element(title()).toBeVisible();
	await expect.element(body()).toBeVisible();
}
const stored = async ({ site, id }: Loaded) =>
	(
		(await site.monti.run("entries.get", { id }, entry.admin)) as {
			entry: { title: string; version: number; values: Record<string, unknown> };
		}
	).entry;

describe("the entry editor: '✦ fill' on a field (T69; doc 10, quick tasks)", () => {
	it("10-1 '채우기' on an empty field asks the quick-task model once: the answer goes in blue and unsaved, the button says '다시', typing over it is the person's", async () => {
		const made = on("draft", [], (request) => ({ value: request.prompt.includes("부제") ? "도구보다 글" : "다른 답" }));
		await made.run();
		await opened();
		await userEvent.click(subtitle());
		await userEvent.click(button("부제 채우기"));
		await expect.element(subtitle()).toHaveValue("도구보다 글");
		expect(subtitle().element().hasAttribute("data-proposal")).toBe(true);
		// It is in the field as if typed: unsaved, and nothing is stored until the person saves.
		await saveCell("저장 전 변경 사항");
		expect((await stored(made.loaded())).values.subtitle).toBeUndefined();
		const { model } = made.loaded();
		expect(model.answers).toHaveLength(1);
		// The model was given the entry as the screen has it.
		expect(model.answers[0]?.prompt).toContain("첫 번째 글");
		await expect.element(button("부제 다시 채우기")).toBeVisible();
		await expect.element(button("부제 채우기")).not.toBeInTheDocument();
		// Changed by hand, it is the person's: no longer blue.
		await userEvent.type(subtitle(), "!");
		await expect.element(subtitle()).toHaveValue("도구보다 글!");
		expect(subtitle().element().hasAttribute("data-proposal")).toBe(false);
	});

	it("10-1 [AS-29, AS-30] a fill in the field offers '버리기 · 다시': '버리기' puts back what it had before the first fill, and so does undo in the field", async () => {
		let said = 0;
		const made = on("draft", [], () => ({ value: `덜어낸 것과 남긴 것, ${++said}번째.` }));
		await made.run();
		await opened();
		const before = (summary().element() as HTMLInputElement).value;
		await userEvent.click(summary());
		// No fill yet: nothing to discard.
		await expect.element(button("요약 채운 값 버리기")).not.toBeInTheDocument();
		await userEvent.click(button("요약 다시 채우기"));
		await expect.element(summary()).toHaveValue("덜어낸 것과 남긴 것, 1번째.");
		await userEvent.click(button("요약 채운 값 버리기"));
		await expect.element(summary()).toHaveValue(before);
		expect(summary().element().hasAttribute("data-proposal")).toBe(false);
		await expect.element(button("요약 채운 값 버리기")).not.toBeInTheDocument();
		// Filled twice, then undo in the field: one step back to what it had before the first fill, nothing left unsaved.
		await userEvent.click(button("요약 다시 채우기"));
		await expect.element(summary()).toHaveValue("덜어낸 것과 남긴 것, 2번째.");
		await userEvent.click(button("요약 다시 채우기"));
		await expect.element(summary()).toHaveValue("덜어낸 것과 남긴 것, 3번째.");
		await userEvent.click(summary());
		await userEvent.keyboard("{ControlOrMeta>}z{/ControlOrMeta}");
		await expect.element(summary()).toHaveValue(before);
		await expect.element(button("요약 채운 값 버리기")).not.toBeInTheDocument();
		await expect.poll(cells).not.toContain("저장 전 변경 사항");
	});

	it("10-1 '버리기' after a save puts back what the field had before the fill, unsaved", async () => {
		const made = on("draft", [], () => ({ value: "도구보다 글" }));
		await made.run();
		await opened();
		await userEvent.click(subtitle());
		await userEvent.click(button("부제 채우기"));
		await expect.element(subtitle()).toHaveValue("도구보다 글");
		await userEvent.click(button("저장"));
		await expect.poll(async () => (await stored(made.loaded())).values.subtitle).toBe("도구보다 글");
		await userEvent.click(button("부제 채운 값 버리기"));
		await expect.element(subtitle()).toHaveValue("");
		await saveCell("저장 전 변경 사항");
	});

	it("10-1 undo in a filled relation's search takes back the typing, not the fill", async () => {
		const made = on("draft", [], async () => ({ values: [(await stored(made.loaded())).values.category] }));
		await made.run();
		await opened();
		await userEvent.hover(page.getByText("카테고리", { exact: true }));
		await userEvent.click(button("카테고리 다시 채우기"));
		await expect.element(button("카테고리 채운 값 버리기")).toBeVisible();
		const search = page.getByRole("combobox", { name: "카테고리" });
		await userEvent.click(search);
		await userEvent.keyboard("abc");
		await userEvent.keyboard("{ControlOrMeta>}z{/ControlOrMeta}");
		await expect.poll(() => (document.activeElement as HTMLInputElement).value).not.toBe("개발abc");
		// The open list hides the rest of the screen from the roles: the line is looked for as it is drawn.
		expect(document.querySelector('[aria-label="카테고리 채운 값 버리기"]')).not.toBeNull();
	});

	it("10-1 a field that has a value offers '다시', and the new answer takes the value's place", async () => {
		const made = on("draft", [], () => ({ value: "덜어낸 것과 남긴 것, 다시." }));
		await made.run();
		await opened();
		await userEvent.click(summary());
		await userEvent.click(button("요약 다시 채우기"));
		await expect.element(summary()).toHaveValue("덜어낸 것과 남긴 것, 다시.");
	});

	it("10-1 a service that refuses is said under the field with the key's name, and the field keeps what it had; '다시 시도' asks again and clears the line", async () => {
		let refuse = true;
		const made = on("draft", [], () => {
			if (refuse) throw new ProviderError("refused", "Your credit balance is too low.");
			return { value: "도구보다 글" };
		});
		await made.run();
		await opened();
		await userEvent.click(subtitle());
		await userEvent.click(button("부제 채우기"));
		await expect.element(page.getByText("Anthropic 개인 거절")).toBeVisible();
		await expect.element(subtitle()).toHaveValue("");
		refuse = false;
		await userEvent.click(button("다시 시도"));
		await expect.element(subtitle()).toHaveValue("도구보다 글");
		await expect.element(page.getByText("Anthropic 개인 거절")).not.toBeInTheDocument();
		expect(made.loaded().model.answers).toHaveLength(2);
	});

	it("10-1 while it is asked the line says '생성 중' with '멈추기' in the button's place, so it is asked once", async () => {
		let answerNow = (_value: unknown) => {};
		const held = new Promise((resolve) => {
			answerNow = resolve;
		});
		const made = on("draft", [], () => held);
		await made.run();
		await opened();
		await userEvent.click(subtitle());
		await userEvent.click(button("부제 채우기"));
		await expect.element(page.getByText("생성 중", { exact: true })).toBeVisible();
		await expect.element(button("멈추기")).toBeVisible();
		await expect.element(button("부제 채우기")).not.toBeInTheDocument();
		expect(made.loaded().model.answers).toHaveLength(1);
		answerNow({ value: "도구보다 글" });
		await expect.element(subtitle()).toHaveValue("도구보다 글");
		await expect.element(page.getByText("생성 중", { exact: true })).not.toBeInTheDocument();
	});

	it("10-1 pressed with the keyboard, the focus goes to '멈추기' while it works, and back to the button when it is done", async () => {
		let answerNow = (_value: unknown) => {};
		const held = new Promise((resolve) => {
			answerNow = resolve;
		});
		const made = on("draft", [], () => held);
		await made.run();
		await opened();
		await userEvent.click(subtitle());
		await userEvent.keyboard("{Shift>}{Tab}{/Shift}");
		expect(document.activeElement?.getAttribute("aria-label")).toBe("부제 채우기");
		await userEvent.keyboard("{Enter}");
		await expect.poll(() => document.activeElement?.textContent).toBe("멈추기");
		answerNow({ value: "도구보다 글" });
		await expect.element(subtitle()).toHaveValue("도구보다 글");
		await expect.poll(() => document.activeElement?.getAttribute("aria-label")).toBe("부제 다시 채우기");
	});

	it("10-1 '멈추기' leaves the field as it was: the answer that comes after is not put in", async () => {
		let answerNow = (_value: unknown) => {};
		const held = new Promise((resolve) => {
			answerNow = resolve;
		});
		const made = on("draft", [], () => held);
		await made.run();
		await opened();
		await userEvent.click(subtitle());
		await userEvent.click(button("부제 채우기"));
		await userEvent.click(button("멈추기"));
		await expect.element(page.getByText("생성 중", { exact: true })).not.toBeInTheDocument();
		answerNow({ value: "늦게 온 답" });
		await new Promise((resolve) => setTimeout(resolve, 300));
		await expect.element(subtitle()).toHaveValue("");
	});

	it("10-1 a relation field asked to be filled again when nothing of the site fits keeps its value, and its line says there is nothing to fill it with", async () => {
		const made = on("draft", [], () => ({ values: [] }));
		await made.run();
		await opened();
		const before = (await stored(made.loaded())).values.category;
		expect(before).toBeTruthy();
		await userEvent.hover(page.getByText("카테고리", { exact: true }));
		await userEvent.click(button("카테고리 다시 채우기"));
		await expect.element(page.getByText("채울 값이 없습니다")).toBeVisible();
		// The field keeps its category: nothing is unsaved (an emptied field would be a change).
		await saveCell("저장됨");
	});

	it("10-1 what is typed in a field while its fill is on the way stays: the answer that comes late is not put over it", async () => {
		let answerNow = (_value: unknown) => {};
		const made = on(
			"draft",
			[],
			() =>
				new Promise((resolve) => {
					answerNow = resolve;
				}),
		);
		await made.run();
		await opened();
		await userEvent.click(subtitle());
		await userEvent.click(button("부제 채우기"));
		await expect.element(page.getByText("생성 중", { exact: true })).toBeVisible();
		await userEvent.type(subtitle(), "내가 쓴 부제");
		answerNow({ value: "늦게 온 답" });
		await new Promise((resolve) => setTimeout(resolve, 300));
		await expect.element(subtitle()).toHaveValue("내가 쓴 부제");
		await expect.element(page.getByText("생성 중", { exact: true })).not.toBeInTheDocument();
	});

	it("10-1 a site with no AI key has no '채우기'; a site without the assistant has none either, and no 'AI가 바꾼 기록'", async () => {
		const keyless = on("draft", [], undefined, { key: false });
		await keyless.run();
		await opened();
		await userEvent.click(subtitle());
		await expect.element(subtitle()).toBeVisible();
		await expect.element(button("부제 채우기")).not.toBeInTheDocument();

		const plain = scene<Loaded>({ loaders: entry.site("draft") }, entry.default);
		await plain.run();
		await opened();
		await userEvent.click(subtitle());
		await expect.element(button("부제 채우기")).not.toBeInTheDocument();
		await userEvent.click(button("더 보기"));
		await expect.element(page.getByRole("menuitem", { name: "복제" })).toBeVisible();
		await expect.element(page.getByRole("menuitem", { name: "AI가 바꾼 기록" })).not.toBeInTheDocument();
	});

	it("10-1 [AS-23, AS-21] ⋯ › 'AI가 바꾼 기록' opens the activity log in a new tab, filtered to this entry by its id and to the assistant's lines; the editor stays", async () => {
		const made = on("draft");
		await made.run();
		await opened();
		const opens = vi.spyOn(window, "open").mockReturnValue(null);
		const here = window.location.hash;
		await userEvent.click(button("더 보기"));
		await userEvent.click(page.getByRole("menuitem", { name: "AI가 바꾼 기록" }));
		expect(opens).toHaveBeenCalledWith(`#/activity?entry=${made.loaded().id}&kind=assistant`, "_blank", "noopener");
		expect(window.location.hash).toBe(here);
		await expect.element(page.getByRole("alertdialog")).not.toBeInTheDocument();
		opens.mockRestore();
	});
});

const GROUP = "_group";
/** A block's words with `text` in place of `from`–`to`: its new text for `setText` (the reference entry's paragraphs have no marks). */
const reword = (block: Block | undefined, from: number, to: number, text: string) => {
	const words = plainText(block?.content);
	return words.slice(0, from) + text + words.slice(to);
};
const inBody = (selector: string) => [...body().element().querySelectorAll<HTMLElement>(selector)];
const underlined = () => inBody("[class*=decoration-dotted]");
const mark = (name: string | RegExp) => page.getByRole("button", { name });
const cells = () => [...document.querySelectorAll("[data-slot=status-bar-cell]")].map((cell) => cell.textContent);
const blocksOf = async ({ site, id }: Loaded) =>
	((await site.monti.run("entries.get", { id }, entry.admin)) as { entry: { doc: Doc; version: number } }).entry;
const pending = ({ site, id }: Loaded) =>
	site.monti.run("proposals.forTarget", { kind: "entry", id }, entry.admin) as Promise<
		{ id: string; request: string; input: { ops: { text?: string }[] } }[]
	>;

describe("the entry editor: '✦ fill' that gets no answer in time", () => {
	it("10-1 the quick-task model's deadline is said under the field in its own short line", async () => {
		await scene(assist.FieldFillTimeout, assist.default).run();
	});
});

describe("the entry editor: '✦ request' on picked words (T64; doc 10, item 28)", () => {
	const PICKED = "나머지는 필요할 때 꺼내 본다.";
	/** The model's change of the picked words: the sentence made shorter, at its place in the third paragraph. */
	const shorter =
		(made: { loaded: () => Loaded }, gate?: Promise<unknown>): NonNullable<Script>[number] =>
		async () => {
			const read = await blocksOf(made.loaded());
			const third = read.doc.blocks[2];
			return {
				...(gate ? { hold: gate } : {}),
				calls: [
					{
						name: "body_edit",
						input: {
							id: made.loaded().id,
							version: read.version,
							ops: [{ op: "setText", block: third?.id, text: reword(third, 25, 42, "나머지는 그때 꺼내 본다.") }],
							[GROUP]: "다듬기",
						},
					},
				],
			};
		};

	it("10-1 [AS-06] a request card names the model its request ran on, not the one the page last read as the quick tasks'", async () => {
		const made: ReturnType<typeof on> = on("draft", []);
		await made.run();
		const { monti } = made.loaded().site;
		const keys = (await monti.run("keys.list", {}, { actor: "admin" })) as { keys: { id: string }[] };
		// The quick model changes on the server after the page read it: the pick is tried first (one answer, one turn).
		made.loaded().model.add({ text: "OK" });
		await monti.run(
			"models.choose",
			{ for: "quick", keyId: keys.keys[0].id, model: "claude-sonnet-5-5" },
			{ actor: "admin" },
		);
		made.loaded().model.add({ text: "말로만 답합니다." });
		await opened();
		await pickWords(body().element(), PICKED);
		await userEvent.click(button("요청"));
		// Before it is sent: the quick model as this page knows it.
		await expect.element(page.getByText("빠른 작업 · Claude Haiku 5.5", { exact: true })).toBeVisible();
		await userEvent.fill(page.getByRole("textbox", { name: "어시스턴트에게 요청" }), "뒤 문장만 줄여 줘");
		await userEvent.keyboard("{Enter}");
		// Sent: the one the server ran it on.
		await expect.element(page.getByText("빠른 작업 · Claude Sonnet 5.5", { exact: true })).toBeVisible();
		expect(made.loaded().model.turns.at(-1)?.model).toBe("claude-sonnet-5-5");
	});

	it("10-1 [flow 2·08] '요청' on picked words opens a box with the caret in it, the words underlined; sent, the mark says '…'; the answer is a change drawn there", async () => {
		let release = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const made: ReturnType<typeof on> = on("draft", []);
		await made.run();
		made.loaded().model.add(shorter(made, gate), { text: "뒤 문장을 줄였습니다." });
		await opened();
		await pickWords(body().element(), PICKED);
		await userEvent.click(button("요청"));
		const box = page.getByRole("textbox", { name: "어시스턴트에게 요청" });
		await expect.element(box).toBeVisible();
		await expect.poll(() => document.activeElement === box.element()).toBe(true);
		// The card's foot says which model the request runs on: the quick tasks', by name (AS-06).
		await expect.element(page.getByText("빠른 작업 · Claude Haiku 5.5", { exact: true })).toBeVisible();
		expect(
			underlined()
				.map((each) => each.textContent)
				.join(""),
		).toBe(PICKED);
		// Nothing is asked until it is sent.
		expect(made.loaded().model.turns).toHaveLength(0);

		await userEvent.fill(box, "뒤 문장만 줄여 줘");
		await userEvent.keyboard("{Enter}");
		await expect.element(mark("생성 중인 요청")).toBeVisible();
		await expect.poll(cells).toContain("요청 1· 생성 중 1");
		// What went to the model: the request, with the picked words and where they stand.
		await expect.poll(() => made.loaded().model.turns.length).toBe(1);
		const asked = JSON.stringify(made.loaded().model.turns[0]?.messages.at(-1));
		expect(asked).toContain("뒤 문장만 줄여 줘");
		expect(asked).toContain(PICKED);

		release();
		// The change is drawn where the words were; the request's own mark and underline give way to the change's.
		// Word by word: "필요할 때" struck through, "그때" put in beside it.
		await expect.poll(() => inBody("ins").map((each) => each.textContent)).toEqual(["그때"]);
		await expect.poll(underlined).toHaveLength(0);
		await expect.element(mark("생성 중인 요청")).not.toBeInTheDocument();
		await expect.element(mark("제안: 뒤 문장만 줄여 줘")).toBeVisible();
		// The bubble is named by what was asked, and nothing is changed until it is taken.
		await expect.element(page.getByText("1 / 1")).toBeVisible();
		expect((await pending(made.loaded())).map((item) => item.request)).toEqual(["뒤 문장만 줄여 줘"]);
		expect((await blocksOf(made.loaded())).version).toBe(1);
	});

	it("10-1 ⌘J opens the same card on the picked words; closed with nothing sent, it leaves no mark and no underline", async () => {
		const made = on("draft");
		await made.run();
		await opened();
		await pickWords(body().element(), PICKED);
		await userEvent.keyboard("{Meta>}j{/Meta}");
		await expect.element(page.getByRole("textbox", { name: "어시스턴트에게 요청" })).toBeVisible();
		expect(underlined().length).toBeGreaterThan(0);
		await userEvent.keyboard("{Escape}");
		await expect.element(page.getByRole("textbox", { name: "어시스턴트에게 요청" })).not.toBeInTheDocument();
		await expect.poll(underlined).toHaveLength(0);
		expect(made.loaded().model.turns).toHaveLength(0);
	});

	it("10-1 an answer that proposes nothing stays in the request's card, with '버리기' and a box to go on; discarding it leaves nothing", async () => {
		const made = on("draft", [{ text: "이 문장은 이미 짧아서 그대로 두는 편이 좋습니다." }]);
		await made.run();
		await opened();
		await pickWords(body().element(), PICKED);
		await userEvent.click(button("요청"));
		await userEvent.fill(page.getByRole("textbox", { name: "어시스턴트에게 요청" }), "더 줄일 수 있어?");
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByText("이 문장은 이미 짧아서 그대로 두는 편이 좋습니다.")).toBeVisible();
		await expect.element(page.getByText("더 줄일 수 있어?")).toBeVisible();
		await expect.element(page.getByRole("textbox", { name: "이어서 요청" })).toBeVisible();
		await userEvent.click(button("버리기"));
		await expect.element(page.getByText("이 문장은 이미 짧아서 그대로 두는 편이 좋습니다.")).not.toBeInTheDocument();
		await expect.poll(underlined).toHaveLength(0);
		expect(await pending(made.loaded())).toEqual([]);
	});

	it("10-1 an archived entry and a site without the assistant have no '요청' on the format card", async () => {
		const plain = scene<Loaded>({ loaders: entry.site("draft") }, entry.default);
		await plain.run();
		await opened();
		await pickWords(body().element(), PICKED);
		await expect.element(button("굵게")).toBeVisible();
		await expect.element(button("요청")).not.toBeInTheDocument();
	});
});

describe("the entry editor: one proposed change's own card (T41; doc 05, 'one by one')", () => {
	const MARK = "제안: 더 짧게 다듬기";
	async function proposed(script: Script = []) {
		const made = on("proposed", script);
		await made.run();
		await opened();
		await expect.poll(() => inBody("ins")).toHaveLength(2);
		return made;
	}

	it("10-1 each change drawn over the text has its mark beside its block: it opens a card with '버리기', '받기', the request and a box to go on", async () => {
		await proposed();
		// Three changes of one request: a shorter phrase, a line put in, a paragraph taken out.
		await expect.poll(() => mark(MARK).elements().length).toBe(3);
		await userEvent.click(mark(MARK).first());
		await expect.element(button("버리기")).toBeVisible();
		await expect.element(button("받기")).toBeVisible();
		// What it was made for stands in the card, as the person's own words.
		await expect
			.poll(() => [...document.querySelectorAll("[data-slot=memo-message]")].map((message) => message.textContent))
			.toEqual(["나더 짧게 다듬기"]);
		await expect.element(page.getByRole("textbox", { name: "이어서 요청" })).toBeVisible();
		// The text keeps the focus: the card is beside what is read. The mark again closes it.
		await userEvent.click(mark(MARK).first());
		await expect.element(button("받기")).not.toBeInTheDocument();
	});

	it("10-3 '받기' on the card takes that change alone, unsaved; the others still wait", async () => {
		const made = await proposed();
		await userEvent.click(mark(MARK).first());
		await userEvent.click(button("받기"));
		await expect.poll(() => body().element().textContent).toContain("블로그를 다시 만든 건");
		await expect.poll(() => inBody("ins")).toHaveLength(1);
		await saveCell("저장 전 변경 사항");
		await expect.poll(() => mark(MARK).elements().length).toBe(2);
		expect(await pending(made.loaded())).toHaveLength(3);
	});

	it("10-3 [AS-22] a change taken here is the assistant's in the log once saved: ⋯ › 'AI가 바꾼 기록' shows the save quoting its request", async () => {
		const made = await proposed();
		await userEvent.click(mark(MARK).first());
		await userEvent.click(button("받기"));
		await saveCell("저장 전 변경 사항");
		await userEvent.click(button("저장"));
		await expect.poll(async () => (await pending(made.loaded())).length).toBe(2);
		const opens = vi.spyOn(window, "open").mockReturnValue(null);
		await userEvent.click(button("더 보기"));
		await userEvent.click(page.getByRole("menuitem", { name: "AI가 바꾼 기록" }));
		// The tab it opens, gone to here.
		window.location.hash = String(opens.mock.calls[0]?.[0]);
		opens.mockRestore();
		const line = page.getByRole("main").getByRole("row").filter({ hasText: "더 짧게 다듬기" });
		await expect.element(line).toBeVisible();
		await expect.element(line).toHaveTextContent('"첫 번째 글" 저장');
	});

	it("10-3 [AS-19] undo right after '받기' takes back the words and the take together: the change waits, drawn again, with nothing unsaved", async () => {
		const made = await proposed();
		await userEvent.click(mark(MARK).first());
		await userEvent.click(button("받기"));
		await expect.poll(() => mark(MARK).elements().length).toBe(2);
		await saveCell("저장 전 변경 사항");
		body().element().focus();
		await userEvent.keyboard("{ControlOrMeta>}z{/ControlOrMeta}");
		await expect.poll(() => mark(MARK).elements().length).toBe(3);
		await expect.poll(() => inBody("ins")).toHaveLength(2);
		// Not taken any more: nothing to save, and the server still has all three waiting.
		await saveCell("제안 3건 대기");
		expect(await pending(made.loaded())).toHaveLength(3);
		// Redo takes it again, as one step.
		await userEvent.keyboard("{ControlOrMeta>}{Shift>}z{/Shift}{/ControlOrMeta}");
		await expect.poll(() => mark(MARK).elements().length).toBe(2);
		await saveCell("저장 전 변경 사항");
	});

	it("10-1 [AS-12] pressing a change drawn over the text opens its own card, with '버리기' and '받기'", async () => {
		await proposed();
		const drawn = inBody("ins[data-proposal-item]")[0];
		if (!drawn) throw new Error("No change is drawn.");
		await userEvent.click(drawn);
		await expect.element(button("받기")).toBeVisible();
		await expect.element(button("버리기")).toBeVisible();
	});

	it("10-1 [AS-12] a line put in at the very start opens its own card when pressed, as any other change", async () => {
		await scene<Loaded>(
			{ loaders: [assisted([]), ...entry.site("proposedAtStart")], play: entry.BodyProposalAtStart.play },
			entry.default,
		).run();
		const drawn = () => inBody("[data-proposal-item]")[0];
		await expect.poll(() => drawn()?.textContent).toContain("이 글은 다시 만든 기록이다.");
		await userEvent.click(drawn() as Element);
		await expect.element(button("받기")).toBeVisible();
		await expect.element(button("버리기")).toBeVisible();
	});

	it("10-1 '버리기' on the card discards that change alone: its marks go from the text, the others stay, nothing is changed", async () => {
		const made = await proposed();
		await userEvent.click(mark(MARK).first());
		await userEvent.click(button("버리기"));
		await expect.poll(async () => (await pending(made.loaded())).length).toBe(2);
		await expect.poll(() => inBody("ins").map((each) => each.textContent)).toEqual(["상태도 색 대신 글자로 적었다."]);
		// Nothing unsaved: the save cell says the two proposals still waiting (AS-18).
		await saveCell("제안 2건 대기");
	});

	it("10-1 [AS-26] a request at a change that did not go keeps its words in the card with why and '다시 시도', which asks the same again", async () => {
		const made = await proposed();
		made.loaded().model.add({ fail: new ProviderError("unreachable", "socket hang up") });
		await userEvent.click(mark(MARK).first());
		await userEvent.fill(page.getByRole("textbox", { name: "이어서 요청" }), "더 짧게");
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByText("Anthropic 개인 응답 없음")).toBeVisible();
		// No toast, and the card still holds what was asked.
		await expect.element(page.getByText("더 짧게", { exact: true })).toBeVisible();
		expect(document.querySelectorAll("[data-sonner-toast]")).toHaveLength(0);
		made.loaded().model.add({ text: "그대로 두는 게 낫겠습니다." });
		await userEvent.click(button("다시 시도"));
		await expect.element(page.getByText("Anthropic 개인 응답 없음")).not.toBeInTheDocument();
		// The same words went again, once: the failed ask gave way to the new one.
		const asked = made.loaded().model.turns.map((turn) => JSON.stringify(turn.messages.at(-1)));
		expect(asked.at(-1)).toContain("더 짧게");
		await expect.poll(() => page.getByText("더 짧게", { exact: true }).elements().length).toBe(1);
	});

	it("10-1 a failed request at a change goes with the change: discarded, the status bar no longer counts it", async () => {
		const made = await proposed();
		made.loaded().model.add({ fail: new ProviderError("unreachable", "socket hang up") });
		await userEvent.click(mark(MARK).first());
		await userEvent.fill(page.getByRole("textbox", { name: "이어서 요청" }), "더 짧게");
		await userEvent.keyboard("{Enter}");
		await expect.element(page.getByText("Anthropic 개인 응답 없음")).toBeVisible();
		await expect.poll(cells).toContain("요청 1");
		await userEvent.click(button("버리기"));
		await expect.poll(async () => (await pending(made.loaded())).length).toBe(2);
		await expect.poll(() => cells().some((cell) => cell?.startsWith("요청"))).toBe(false);
	});

	it("10-1 [flow 2·09] '이어서 요청' has that change made differently: the mark says '…' meanwhile, and the change is replaced where it stood", async () => {
		let release = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const made = await proposed();
		const read = await blocksOf(made.loaded());
		made.loaded().model.add(
			{
				hold: gate,
				calls: [
					{
						name: "body_edit",
						input: {
							id: made.loaded().id,
							version: read.version,
							ops: [{ op: "setText", block: read.doc.blocks[0]?.id, text: reword(read.doc.blocks[0], 8, 14, "고친") }],
							[GROUP]: "다듬기",
						},
					},
				],
			},
			{ text: "'만든'을 '고친'으로 바꿨습니다." },
		);
		await userEvent.click(mark(MARK).first());
		await userEvent.fill(page.getByRole("textbox", { name: "이어서 요청" }), "'고친'으로 해 줘");
		await userEvent.keyboard("{Enter}");
		await expect.element(mark("생성 중인 제안: 더 짧게 다듬기")).toBeVisible();
		await expect.element(button("멈추기")).toBeVisible();
		await expect.element(page.getByText("생성 중", { exact: true })).toBeVisible();
		// While it works the card has no way to take or discard the change.
		await expect.element(button("받기")).not.toBeInTheDocument();
		await expect.poll(cells).toContain("요청 1· 생성 중 1");
		release();
		await expect.poll(() => inBody("ins").map((each) => each.textContent)).toContain("고친");
		// Still three changes of that request: the one asked about was replaced where it stood, not added to.
		const items = await pending(made.loaded());
		expect(items).toHaveLength(3);
		expect(items[0]?.input.ops[0]?.text).toBe(reword(read.doc.blocks[0], 8, 14, "고친"));
		await expect.element(page.getByText("'만든'을 '고친'으로 바꿨습니다.")).toBeVisible();
		await expect.element(page.getByText("'고친'으로 해 줘")).toBeVisible();
		// Asked once at this place: the status bar still counts it, and says nothing of work while there is none.
		await expect.poll(cells).toContain("요청 1");
	});
	it("10-1 '멈추기' under the answer stops the work on a request: the run is told to stop, the change stays as it was, and its card can take or discard it again", async () => {
		let release = () => {};
		const gate = new Promise<void>((resolve) => {
			release = resolve;
		});
		const made = await proposed();
		made.loaded().model.add({ hold: gate, text: "생각 중" });
		await userEvent.click(mark(MARK).first());
		await userEvent.fill(page.getByRole("textbox", { name: "이어서 요청" }), "더 짧게");
		await userEvent.keyboard("{Enter}");
		await expect.element(button("멈추기")).toBeVisible();
		await userEvent.click(button("멈추기"));
		await expect
			.poll(async () =>
				(await made.loaded().site.db.selectFrom("runs").select("stop_requested").execute()).map(
					(each) => each.stop_requested,
				),
			)
			.toEqual([true]);
		release();
		await expect.element(mark(MARK).first()).toBeVisible();
		await expect.element(mark("생성 중인 제안: 더 짧게 다듬기")).not.toBeInTheDocument();
		const items = await pending(made.loaded());
		expect(items).toHaveLength(3);
		expect(items[0]?.input.ops[0]?.text).toContain("다시 만든 건");
	});
});
