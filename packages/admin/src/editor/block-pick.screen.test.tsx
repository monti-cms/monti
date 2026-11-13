import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { caretAfter, dragPath, dropDrag, middleOf, onTopOf, pickWords, pointerPath } from "../../../../testing/input";
import { scene } from "../../test/scene";
import * as entry from "../screens/entry/entry.stories";

/** The entry's body: a paragraph, the heading "무엇을 덜어냈나", and two paragraphs. */
const draft = () => scene(entry.Draft, entry.default).run();

const FIRST = "블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.";
const HEADING = "무엇을 덜어냈나";
const THIRD = "목록에는 제목과 주소, 지금 상태만 남겼다. 나머지는 필요할 때 꺼내 본다.";
const LAST = "편집기도 같은 원칙으로 정리했다. 글을 쓰는 동안 보이는 건 글뿐이다.";

const body = () => page.getByRole("textbox", { name: "본문" });
/** The body's blocks, top to bottom, by their words. */
const blocks = () => [...body().element().querySelectorAll(":scope > *")].map((block) => block.textContent);
/** The blocks picked whole, by their words. */
const picked = () => [...body().element().querySelectorAll("[data-picked]")].map((block) => block.textContent);
const block = (words: string) => body().getByText(words, { exact: true });
const handle = () => page.getByRole("button", { name: "블록 메뉴" });

async function opened() {
	await draft();
	await expect.element(block(LAST)).toBeVisible();
}

/** Where a box starts: in the margin left of the text, clear of the handle, level with a block. */
const marginBeside = (words: string, from: "top" | "bottom") => {
	const text = body().element().getBoundingClientRect();
	const line = block(words).element().getBoundingClientRect();
	return { x: text.left - 56, y: from === "top" ? line.top + 2 : line.bottom - 2 };
};

/** A box from the margin beside one block down to another. */
async function boxOver(first: string, last: string) {
	const start = marginBeside(first, "top");
	const end = marginBeside(last, "bottom");
	await dragPath([start, { x: start.x + 120, y: end.y }], { steps: 10 });
}

/** Brings out the handle of a block: the pointer goes over the block, then to its margin. */
async function handleOf(words: string, which: "first" | "last" = "first") {
	const line = block(words)[which]().element().getBoundingClientRect();
	await pointerPath([
		{ x: line.left + 40, y: line.top + 8 },
		{ x: line.left - 14, y: line.top + 12 },
	]);
	await expect.element(handle()).toBeVisible();
	return handle();
}

describe("T80 picking several blocks whole", () => {
	it("[dragging] a box dragged from the margin draws a thin line and picks every block it touches; Backspace takes them out and undo brings them back", async () => {
		await opened();
		const start = marginBeside(HEADING, "top");
		const end = marginBeside(THIRD, "bottom");
		await dragPath([start, { x: start.x + 120, y: end.y }], { steps: 10, hold: true });
		await expect.poll(() => document.querySelector("[data-slot=pick-box]")).not.toBeNull();
		await expect.poll(picked).toEqual([HEADING, THIRD]);
		await dropDrag();
		await expect.poll(() => document.querySelector("[data-slot=pick-box]")).toBeNull();
		// Still picked after the release, and nothing was put at the end by the release's click.
		expect(picked()).toEqual([HEADING, THIRD]);
		await userEvent.keyboard("{Backspace}");
		await expect.poll(blocks).toEqual([FIRST, LAST]);
		await userEvent.keyboard("{ControlOrMeta>}z{/ControlOrMeta}");
		await expect.poll(blocks).toEqual([FIRST, HEADING, THIRD, LAST]);
		// Back with a caret, not with words picked across the blocks that the next Backspace would run together.
		expect(getSelection()?.isCollapsed).toBe(true);
	});

	it("the handle of a picked block opens the menu of them all: '블록 2개' with 위로, 아래로, 복제, 삭제", async () => {
		await opened();
		await boxOver(HEADING, THIRD);
		await expect.poll(picked).toEqual([HEADING, THIRD]);
		await userEvent.click(await handleOf(THIRD));
		await expect.element(page.getByRole("menu").getByText("블록 2개")).toBeVisible();
		await userEvent.click(page.getByRole("menuitem", { name: "아래로" }));
		await expect.poll(blocks).toEqual([FIRST, LAST, HEADING, THIRD]);
		// They stay picked where they went, so the next step takes them again.
		await expect.poll(picked).toEqual([HEADING, THIRD]);
		await userEvent.click(await handleOf(HEADING));
		await userEvent.click(page.getByRole("menuitem", { name: "복제" }));
		await expect.poll(blocks).toEqual([FIRST, LAST, HEADING, THIRD, HEADING, THIRD]);
		// The copies are picked now, at the end: nothing is below them.
		await expect.poll(() => body().element().querySelector("[data-picked]:last-child")?.textContent).toBe(THIRD);
		await userEvent.click(await handleOf(THIRD, "last"));
		await expect.element(page.getByRole("menu").getByText("블록 2개")).toBeVisible();
		await expect.element(page.getByRole("menuitem", { name: "아래로" })).not.toBeInTheDocument();
		await userEvent.click(page.getByRole("menuitem", { name: "삭제" }));
		await expect.poll(blocks).toEqual([FIRST, LAST, HEADING, THIRD]);
	});

	it("the handle of a block that is not picked lets the pick go and opens that block's own menu", async () => {
		await opened();
		await boxOver(FIRST, HEADING);
		await expect.poll(picked).toEqual([FIRST, HEADING]);
		await userEvent.click(await handleOf(LAST));
		await expect.poll(picked).toEqual([]);
		await expect.element(page.getByRole("menu").getByText("문단")).toBeVisible();
		await expect.element(page.getByRole("menu").getByText("블록 2개")).not.toBeInTheDocument();
	});

	it("Shift with a press on another block's handle picks every block from the first picked one to it", async () => {
		await opened();
		await boxOver(FIRST, FIRST);
		await expect.poll(picked).toEqual([FIRST]);
		await userEvent.click(await handleOf(THIRD), { modifiers: ["Shift"] });
		await expect.poll(picked).toEqual([FIRST, HEADING, THIRD]);
		await expect.element(page.getByRole("menu")).not.toBeInTheDocument();
	});

	it("Esc on words picked across two blocks picks those blocks whole", async () => {
		await opened();
		await pickWords(body().element(), "때문이다.");
		await userEvent.keyboard("{Shift>}{ArrowDown}{ArrowDown}{/Shift}");
		await userEvent.keyboard("{Escape}");
		await expect.poll(picked).toEqual([FIRST, HEADING, THIRD]);
		await userEvent.keyboard("{Delete}");
		await expect.poll(blocks).toEqual([LAST]);
	});

	it("[dragging] [dropped] dragging the handle of a picked block moves them all together, in their order", async () => {
		await opened();
		await boxOver(FIRST, HEADING);
		await expect.poll(picked).toEqual([FIRST, HEADING]);
		const grip = (await handleOf(HEADING)).element();
		const last = block(LAST).element().getBoundingClientRect();
		await dragPath([middleOf(grip), { x: last.left + 40, y: last.bottom - 4 }], { steps: 12, hold: true });
		await expect.poll(() => body().element().querySelectorAll("[data-held]").length).toBe(2);
		await expect.element(page.getByText("블록 2개")).toBeVisible();
		await dropDrag();
		await expect.poll(blocks).toEqual([THIRD, LAST, FIRST, HEADING]);
		await expect.poll(picked).toEqual([FIRST, HEADING]);
	});

	it("[dragging] [dropped] picked blocks dropped between two list items cut the list there, and every one of them lands, none other", async () => {
		await opened();
		await caretAfter(body().element(), "글뿐이다.");
		await userEvent.keyboard("{Enter}- 하나{Enter}둘{Enter}셋");
		await expect.poll(blocks).toEqual([FIRST, HEADING, THIRD, LAST, "하나둘셋"]);
		await boxOver(FIRST, HEADING);
		await expect.poll(picked).toEqual([FIRST, HEADING]);
		const grip = (await handleOf(HEADING)).element();
		const one = body().getByText("하나", { exact: true }).element().getBoundingClientRect();
		await dragPath([middleOf(grip), { x: one.left + 20, y: one.bottom - 3 }], { steps: 12 });
		await expect.poll(blocks).toEqual([THIRD, LAST, "하나", FIRST, HEADING, "둘셋"]);
		await expect.poll(picked).toEqual([FIRST, HEADING]);
	});

	it("⌘X puts the picked blocks themselves on the clipboard and takes them out; pasting brings them back", async () => {
		await opened();
		await boxOver(HEADING, THIRD);
		await expect.poll(picked).toEqual([HEADING, THIRD]);
		await userEvent.keyboard("{ControlOrMeta>}x{/ControlOrMeta}");
		await expect.poll(blocks).toEqual([FIRST, LAST]);
		await caretAfter(body().element(), "글뿐이다.");
		await userEvent.keyboard("{Enter}");
		await userEvent.keyboard("{ControlOrMeta>}v{/ControlOrMeta}");
		await expect.poll(blocks).toEqual([FIRST, LAST, HEADING, THIRD]);
		expect(body().element().querySelector("h2")?.textContent).toBe(HEADING);
	});
});

describe("T80 a pick that takes in a code block (doc 17)", () => {
	const ABOVE = "버튼을 누를 때마다 수를 하나 올린다.";
	const BELOW = "다음 문단.";
	/** The body's blocks, top to bottom: a code block as "code", any other by its words. */
	const kinds = () =>
		[...body().element().querySelectorAll(":scope > *")].map((each) =>
			each.matches("[data-block=codeBlock]") || each.querySelector("[data-block=codeBlock]")
				? "code"
				: each.textContent,
		);
	const pickedKinds = () =>
		[...body().element().querySelectorAll("[data-picked]")].map((each) =>
			each.matches("[data-block=codeBlock]") || each.querySelector("[data-block=codeBlock]")
				? "code"
				: each.textContent,
		);
	const codeBox = () => body().element().querySelector<HTMLElement>("[data-block=codeBlock]");

	it("[dragging] [dropped] a box over a paragraph and the code block picks both; the code block's handle moves them whole, Backspace takes them out, undo brings them back", async () => {
		await scene({ loaders: entry.site("code") }, entry.default).run();
		await expect.poll(() => codeBox()?.querySelectorAll("[data-slot=code-number]").length ?? 0).toBe(6);
		const text = body().element().getBoundingClientRect();
		const above = block(ABOVE).element().getBoundingClientRect();
		const code = codeBox()?.getBoundingClientRect();
		if (!code) throw new Error("no code block");
		await dragPath(
			[
				{ x: text.left - 56, y: above.top + 2 },
				{ x: text.left + 64, y: code.top + code.height / 2 },
			],
			{ steps: 10 },
		);
		await expect.poll(pickedKinds).toEqual([ABOVE, "code"]);

		// The code block's handle: on top where it is pressed, whatever tool row the block shows.
		await pointerPath([
			{ x: code.left + 80, y: code.top + 12 },
			{ x: code.left - 14, y: code.top + 12 },
		]);
		await expect.element(handle()).toBeVisible();
		const grip = handle().element();
		expect(grip.contains(onTopOf(grip))).toBe(true);
		const below = block(BELOW).element().getBoundingClientRect();
		await dragPath([middleOf(grip), { x: below.left + 40, y: below.bottom - 3 }], { steps: 12 });
		await expect.poll(kinds).toEqual([BELOW, ABOVE, "code"]);
		await expect.poll(pickedKinds).toEqual([ABOVE, "code"]);
		// The code came whole: its six lines and its language.
		expect(codeBox()?.querySelectorAll("[data-slot=code-number]").length).toBe(6);
		expect(codeBox()?.querySelector("[data-slot=code-frame-head]")?.textContent).toContain("TypeScript");

		await userEvent.keyboard("{Backspace}");
		await expect.poll(kinds).toEqual([BELOW]);
		await userEvent.keyboard("{ControlOrMeta>}z{/ControlOrMeta}");
		await expect.poll(kinds).toEqual([BELOW, ABOVE, "code"]);
		await expect.poll(() => codeBox()?.querySelectorAll("[data-slot=code-number]").length ?? 0).toBe(6);
	});
});
