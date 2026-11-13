import type { Doc } from "@monti-cms/core";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { caretAfter, pickWords } from "../../../../../testing/input";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import * as entry from "../../screens/entry/entry.stories";

type Loaded = { site: StorySite; id: string };

/** The editor on an entry with a code block (doc 17), with its site at hand. */
const on = (kind: "code" | "codeBroken") => scene<Loaded>({ loaders: entry.site(kind) }, entry.default);

const body = () => page.getByRole("textbox", { name: "본문" });
const button = (name: string | RegExp) => page.getByRole("button", { name, exact: true });
const code = () => body().element().querySelector<HTMLElement>("[data-block=codeBlock]");
const numbers = () => [...(code()?.querySelectorAll<HTMLElement>("[data-slot=code-number]") ?? [])];
/** The line number row of line `n` (from 1). */
const number = (n: number) => numbers().find((row) => row.dataset.line === String(n - 1));
const tones = () => numbers().map((row) => `${Number(row.dataset.line) + 1}:${row.dataset.tone ?? ""}`);
const save = () => userEvent.keyboard("{ControlOrMeta>}s{/ControlOrMeta}");
const kept = async ({ site, id }: Loaded) =>
	((await site.monti.run("entries.get", { id }, entry.admin)) as { entry: { doc: Doc } }).entry.doc.blocks;
const keptCode = async (loaded: Loaded) => (await kept(loaded)).find((block) => block.type === "codeBlock");

/**
 * The pointer off the code block, and its tool row gone: the row the pointer shows stands over the paragraph above the block, where a press meant
 * for the paragraph's words would land on it (the pointer stays where the last test left it). Every test starts from here.
 */
async function pointerOff() {
	await userEvent.hover(page.getByRole("textbox", { name: "제목" }));
	await expect.element(page.getByRole("toolbar", { name: "코드 도구" })).not.toBeInTheDocument();
}

async function opened() {
	await expect.element(body()).toBeVisible();
	await expect.poll(() => numbers().length).toBe(6);
	await pointerOff();
}

/** Puts the caret in the code, after these words. */
async function intoCode(words: string) {
	const box = code();
	if (!box) throw new Error("no code block");
	await caretAfter(box, words);
}

describe("the code block in the editor (doc 17)", () => {
	it("the head row says the language and the file name, and the code is coloured by the site's theme", async () => {
		await on("code").run();
		await opened();
		const head = code()?.querySelector("[data-slot=code-frame-head]")?.textContent;
		expect(head).toContain("TypeScript");
		expect(head).toContain("src/counter.ts");
		await expect.poll(() => code()?.querySelectorAll("[data-token]").length ?? 0).toBeGreaterThan(3);
	});

	it("the caret in the code brings the block's tool row; a language picked from its list is the block's", async () => {
		const story = on("code");
		await story.run();
		await opened();
		await expect.element(page.getByRole("toolbar", { name: "코드 도구" })).not.toBeInTheDocument();
		await intoCode("let count");
		await expect.element(page.getByRole("toolbar", { name: "코드 도구" })).toBeVisible();
		await userEvent.click(button("언어: TypeScript"));
		await userEvent.type(page.getByRole("combobox", { name: "언어 찾기" }), "pyth");
		await userEvent.click(page.getByRole("option", { name: /Python/ }));
		await expect.poll(() => code()?.querySelector("[data-slot=code-frame-head]")?.textContent).toContain("Python");
		await save();
		await expect.poll(async () => (await keptCode(story.loaded()))?.attrs?.language).toBe("python");
	});

	it("the file name is typed in the tool row's card and shows in the head row", async () => {
		const story = on("code");
		await story.run();
		await opened();
		await intoCode("let count");
		await userEvent.click(button("파일 이름"));
		const field = page.getByRole("textbox", { name: "파일 이름" });
		await userEvent.clear(field);
		await userEvent.type(field, "lib/count.ts{Enter}");
		await expect
			.poll(() => code()?.querySelector("[data-slot=code-frame-head]")?.textContent)
			.toContain("lib/count.ts");
		await save();
		await expect.poll(async () => (await keptCode(story.loaded()))?.attrs?.title).toBe("lib/count.ts");
	});

	it("a press on line 5's number and a Shift press on line 6's pick both; on release the menu opens, and 강조 marks both lines", async () => {
		const story = on("code");
		await story.run();
		await opened();
		const fifth = number(5);
		const sixth = number(6);
		if (!fifth || !sixth) throw new Error("no line numbers");
		await userEvent.click(fifth);
		await userEvent.keyboard("{Shift>}");
		await userEvent.click(sixth);
		await userEvent.keyboard("{/Shift}");
		await expect.element(page.getByText("5–6번째 줄 효과")).toBeVisible();
		expect(tones()).toContain("5:picked");
		expect(tones()).toContain("6:picked");
		await userEvent.click(page.getByRole("menuitemcheckbox", { name: "강조" }));
		await userEvent.keyboard("{Escape}");
		await expect.poll(tones).toContain("6:highlight");
		await save();
		await expect
			.poll(async () => (await keptCode(story.loaded()))?.attrs?.lines)
			.toContainEqual({ name: "highlight", start: 4, end: 6 });
	});

	it("a line put in after line 1 leaves line 1's effect where it is and takes the fold below it down a line", async () => {
		const story = on("code");
		await story.run();
		await opened();
		await expect.poll(tones).toContain("1:plus");
		const box = code();
		if (!box) throw new Error("no code block");
		await caretAfter(box, "let count = 0;");
		await userEvent.keyboard("{Enter}");
		await expect.poll(() => numbers().length).toBe(7);
		await expect.element(button("3번째 줄부터 접기")).toBeVisible();
		expect(tones()).toContain("1:plus");
		await save();
		const lines = async () => (await keptCode(story.loaded()))?.attrs?.lines;
		await expect.poll(lines).toContainEqual({ name: "plus", start: 0, end: 1 });
		await expect.poll(lines).toContainEqual({ name: "collapse", start: 2, end: 5, attrs: { open: true } });
	});

	it("the fold's button closes lines 2–4 into line 2 with its count, and the count opens them again", async () => {
		await on("code").run();
		await opened();
		await userEvent.click(button("2번째 줄부터 접기"));
		await expect.poll(() => numbers().length).toBe(4);
		await userEvent.click(button("접힌 2줄"));
		await expect.poll(() => numbers().length).toBe(6);
	});

	it("a selection over a closed fold shows its lines, and their numbers with them, level with the code", async () => {
		await on("code").run();
		await opened();
		await userEvent.click(button("2번째 줄부터 접기"));
		await expect.poll(() => numbers().length).toBe(4);
		const box = code();
		if (!box) throw new Error("no code block");
		await caretAfter(box, "let count");
		await userEvent.keyboard("{ControlOrMeta>}a{/ControlOrMeta}");
		await expect.poll(() => numbers().length).toBe(6);
		expect(box.querySelectorAll("[data-code-hidden]").length).toBe(0);
	});

	it("a rule added in the rules card finds every `count` and makes it bold", async () => {
		const story = on("code");
		await story.run();
		await opened();
		await intoCode("let count");
		await userEvent.click(button("정규식 규칙"));
		await userEvent.click(page.getByRole("option", { name: "규칙 추가" }));
		await userEvent.type(page.getByRole("textbox", { name: "정규식" }), "count");
		await expect.element(page.getByText("3곳에 적용")).toBeVisible();
		await expect.poll(() => code()?.querySelectorAll("[data-effect=bold]").length).toBe(3);
		await save();
		await expect
			.poll(async () => (await keptCode(story.loaded()))?.attrs?.rules)
			.toEqual([{ scope: "document", name: "bold", pattern: "count", flags: "g" }]);
	});

	it("words picked in code bring the format card with the formats code takes, and the tool row's tooltip", async () => {
		const story = on("code");
		await story.run();
		await opened();
		const box = code();
		if (!box) throw new Error("no code block");
		await pickWords(box, "reset");
		await expect.element(button("굵게")).toBeVisible();
		await expect.element(button("위 첨자")).not.toBeInTheDocument();
		await expect.element(button("링크")).not.toBeInTheDocument();
		await userEvent.click(button("툴팁"));
		await userEvent.type(page.getByRole("textbox", { name: "툴팁 글" }), "처음으로{Enter}");
		await expect.poll(() => box.querySelector("[data-monti-mark=codeTip]")?.textContent).toBe("reset");
		await save();
		await expect
			.poll(async () => (await keptCode(story.loaded()))?.content)
			.toContainEqual({ type: "text", text: "reset", marks: [{ type: "codeTip", text: "처음으로" }] });
	});

	it("pointing at a code link lights its lines; a link made from the text's words to line 1 is kept", async () => {
		const story = on("code");
		await story.run();
		await opened();
		await userEvent.hover(body().getByText("수를 하나 올린다"));
		await expect.poll(tones).toContain("5:lit");
		await pickWords(body().element(), "다음 문단");
		await userEvent.click(button("코드 줄 링크"));
		await expect.element(page.getByText("연결할 코드 줄을 줄 번호에서 골라 주세요")).toBeVisible();
		const first = number(1);
		if (!first) throw new Error("no line numbers");
		await userEvent.click(first);
		await userEvent.click(button("연결"));
		await expect.element(page.getByText("연결할 코드 줄을 줄 번호에서 골라 주세요")).not.toBeInTheDocument();
		await save();
		const last = async () => (await kept(story.loaded())).at(-1)?.content;
		await expect
			.poll(last)
			.toContainEqual({ type: "text", text: "다음 문단", marks: [{ type: "codeRef", block: "b_code", anchor: "c1" }] });
		await expect
			.poll(async () => (await keptCode(story.loaded()))?.attrs?.lines)
			.toContainEqual({ name: "anchor", start: 0, end: 1, attrs: { id: "c1" } });
	});

	it("a code link's card names its lines by the file name; pressing it lights them, and removing the link takes the unused label too", async () => {
		const story = on("code");
		await story.run();
		await opened();
		await pickWords(body().element(), "수를 하나 올린다");
		await userEvent.click(button("코드 줄 링크"));
		await userEvent.click(page.getByRole("option", { name: "src/counter.ts · 5번째 줄" }));
		await expect.poll(tones).toContain("5:lit");
		await pickWords(body().element(), "수를 하나 올린다");
		await userEvent.click(button("코드 줄 링크"));
		await userEvent.click(page.getByRole("option", { name: "링크 떼기" }));
		await save();
		await expect.poll(async () => JSON.stringify(await kept(story.loaded()))).not.toContain("codeRef");
		await expect
			.poll(async () => (await keptCode(story.loaded()))?.attrs?.lines)
			.not.toContainEqual({ name: "anchor", start: 4, end: 5, attrs: { id: "l1" } });
	});

	it("words picked over two blocks have no code link button: a link joins words of one block to lines", async () => {
		await on("code").run();
		await opened();
		await caretAfter(body().element(), "버튼을 누를");
		await userEvent.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}");
		await expect.element(button("굵게")).toBeVisible();
		await expect.element(button("코드 줄 링크")).not.toBeInTheDocument();
		await pickWords(body().element(), "수를 하나");
		await expect.element(button("코드 줄 링크")).toBeVisible();
	});

	it("words pointing at lines that are gone have the broken line, and the publish to-do counts them", async () => {
		await on("codeBroken").run();
		await opened();
		await expect.poll(() => body().element().querySelectorAll("[data-code-ref-broken]").length).toBeGreaterThan(0);
		await userEvent.click(button("할 일 1"));
		await expect.element(page.getByText("끊긴 코드 링크 1개")).toBeVisible();
	});
});
