import type { Doc } from "@monti-cms/core";
import { composeStories } from "@storybook/react-vite";
import { describe, expect, it } from "vitest";
import { page, userEvent } from "vitest/browser";
import { caretAfter, dragPath, dropDrag, middleOf, pickWords } from "../../../../../testing/input";
import type { StorySite } from "../../../.storybook/pglite-site";
import { scene } from "../../../test/scene";
import * as entry from "./entry.stories";

type Loaded = { site: StorySite; id: string };

const { BrowserCopy } = composeStories(entry);

/** The editor on an entry of this kind, with its site at hand. */
const on = (...made: Parameters<typeof entry.site>) => scene<Loaded>({ loaders: entry.site(...made) }, entry.default);
/** A story's state, with its site at hand. */
const from = (story: (typeof entry)["Draft"]) => scene<Loaded>(story, entry.default);

const title = () => page.getByRole("textbox", { name: "제목" });
const body = () => page.getByRole("textbox", { name: "본문" });
const button = (name: string | RegExp) => page.getByRole("button", { name });
const within = (selector: string) => [...body().element().querySelectorAll<HTMLElement>(selector)];

/** Waits for the editor: its title and its body. */
async function opened() {
	await expect.element(title()).toBeVisible();
	await expect.element(body()).toBeVisible();
}

/** The save cell says this (a live region repeats its words for screen readers, so the cell is read by its slot). */
const saveCell = (text: string) =>
	expect
		.poll(() => [...document.querySelectorAll("[data-slot=status-bar-cell]")].map((cell) => cell.textContent))
		.toContain(text);

/** Puts the caret at the end of the title: a press past its last letter. */
async function titleEnd() {
	const box = title().element().getBoundingClientRect();
	await userEvent.click(title(), { position: { x: box.width - 4, y: box.height / 2 } });
}

const save = () => userEvent.keyboard("{Meta>}s{/Meta}");
const kept = async ({ site, id }: Loaded) =>
	((await site.monti.run("entries.get", { id }, entry.admin)) as { entry: { doc: Doc } }).entry.doc.blocks;

/** The table's column widths as the editor draws them. */
const shares = () => within("col").map((col) => col.style.width);
/** The table is no wider than the body. */
const fitsBody = () => {
	const table = within("table")[0];
	return !!table && table.getBoundingClientRect().width <= body().element().getBoundingClientRect().width + 1;
};
/** The table's cells as rows of text. */
const cells = () => within("tr").map((row) => [...row.querySelectorAll("td, th")].map((cell) => cell.textContent));
const cell = (words: string) => body().getByRole("cell", { name: words, exact: true });
/** The footnotes' numbers and texts, in the order the editor shows them. */
const notes = () => ({
	refs: within("[data-footnote-ref]").map((ref) => ref.getAttribute("data-n")),
	notes: within("[data-footnote]").map((note) => `${note.getAttribute("data-n")}. ${note.textContent}`),
});

describe("the entry editor: saving and coming back", () => {
	it("[flow 1·09] ⌘S saves what was typed: the save cell turns to saved", async () => {
		await on("draft").run();
		await opened();
		await titleEnd();
		await userEvent.keyboard(" 다시 쓰기");
		await save();
		await saveCell("저장됨");
		await expect.element(title()).toHaveValue("첫 번째 글 다시 쓰기");
	});

	it("a to-do's row takes the cursor to its place: the empty title", async () => {
		await on("untitled").run();
		await opened();
		await userEvent.click(button("할 일 2"));
		await userEvent.click(button(/제목 쓰기/));
		await expect.element(title()).toHaveFocus();
	});

	it("[flow 1·19] input this browser kept is compared with the server's copy", async () => {
		await BrowserCopy.run();
		await userEvent.click(button("비교하기"));
		await expect.element(page.getByText("임시 저장본과 비교")).toBeVisible();
		await expect.element(page.getByText(/다른 곳 \d/)).toBeVisible();
	});

	it("15 (T39) signing in again brings back the same entry with what was typed, ready to save", async () => {
		await from(entry.SignedOut).run();
		await userEvent.click(button("다시 로그인"));
		await userEvent.fill(page.getByLabelText("이메일"), "me@example.dev");
		await userEvent.fill(page.getByRole("textbox", { name: "비밀번호" }), "story password");
		await userEvent.click(button("로그인"));
		await expect.element(title()).toHaveValue("첫 번째 글 다시 쓰기");
		await expect.element(page.getByText("로그인이 풀렸습니다")).not.toBeInTheDocument();
		await expect.element(page.getByText("이 브라우저에 저장하지 않은 편집이 있습니다")).not.toBeInTheDocument();
		await userEvent.click(button("저장 전 변경사항"));
		await saveCell("저장됨");
	});

	it("an address typed in the link card is one row that links out", async () => {
		await on("draft").run();
		await opened();
		await pickWords(body().element(), "지금 상태만");
		await userEvent.click(button("링크"));
		await userEvent.fill(page.getByPlaceholder("주소를 붙여 넣거나 글 찾기"), "react.dev/learn");
		await expect.element(page.getByRole("option", { name: /react\.dev\/learn/ })).toBeVisible();
	});
});

describe("the entry editor: tables", () => {
	it("T62 '/' and '표' put in an empty table: three columns under a head row, the caret in its first cell", async () => {
		await on("new").run();
		await opened();
		await userEvent.click(body());
		await userEvent.keyboard("/표");
		await userEvent.click(page.getByRole("option", { name: /^표/ }));
		await expect.poll(() => within("th")).toHaveLength(3);
		expect(within("tr")).toHaveLength(3);
		await userEvent.keyboard("버전");
		await expect.poll(() => within("th")[0]?.textContent).toBe("버전");
		await expect.element(button("1번째 열")).toBeVisible();
	});

	it("a column put in from the column's menu: four columns, and the save keeps the table as rows of text", async () => {
		const story = from(entry.TableColumnMenu);
		await story.run();
		await userEvent.click(page.getByRole("menuitem", { name: "오른쪽에 열 넣기" }));
		await expect.poll(() => cells()[0]).toEqual(["버전", "바뀐 것", "", "날짜"]);
		expect(fitsBody()).toBe(true);
		await save();
		await saveCell("저장됨");
		const table = (await kept(story.loaded())).find((block) => block.type === "table");
		expect(table?.attrs?.rows).toEqual([
			["버전", "바뀐 것", "", "날짜"],
			["1.0", "처음 공개", "", "2024-03-02"],
			["2.0", "편집기 다시 만들기", "", "2025-11-20"],
		]);
		expect(table?.attrs?.header).toBe(true);
	});

	it("a table whose columns were sized: each keeps its share of the body, and the table is as wide as the body", async () => {
		await on("tableSized").run();
		await opened();
		await expect.poll(shares).toEqual(["20%", "50%", "30%"]);
		expect(fitsBody()).toBe(true);
	});

	it("a column put into a sized table gets an even share, the others make room in proportion, and the table stays the body's width", async () => {
		await on("tableSized").run();
		await opened();
		await userEvent.click(cell("편집기 다시 만들기"));
		await userEvent.click(page.getByRole("button", { name: "2번째 열", exact: true }));
		await userEvent.click(page.getByRole("menuitem", { name: "오른쪽에 열 넣기" }));
		await expect.poll(shares).toEqual(["15%", "37.5%", "25%", "22.5%"]);
		expect(fitsBody()).toBe(true);
	});

	it("[dragging] [dropped] a border held and dragged follows the pointer; let go, only the two columns beside it trade width, and the table stays the body's width", async () => {
		await on("tableSized").run();
		await opened();
		await userEvent.click(cell("처음 공개"));
		const border = button("1·2번째 열 너비");
		await expect.element(border).toBeInTheDocument();
		const from = middleOf(border.element());
		const width = within("table")[0]?.getBoundingClientRect().width ?? 0;
		await dragPath([from, { x: from.x + width * 0.1, y: from.y }], { hold: true });
		// The line follows the pointer; the widths change when it is let go.
		await expect.poll(() => Math.abs(middleOf(border.element()).x - (from.x + width * 0.1))).toBeLessThanOrEqual(2);
		expect(shares()).toEqual(["20%", "50%", "30%"]);
		await dropDrag();
		await expect.poll(shares).toEqual(["30%", "40%", "30%"]);
		expect(fitsBody()).toBe(true);
	});
});

describe("the entry editor: footnotes", () => {
	it("words picked and the footnote button pressed: a number after them, its footnote at the end with the caret in it, the others renumbered; the save keeps both", async () => {
		const story = on("footnotes");
		await story.run();
		await opened();
		await pickWords(body().element(), "지금 상태만");
		await userEvent.click(button("각주"));
		await userEvent.keyboard("상태 말고는 덜어냈다.");
		await expect.poll(notes).toEqual({
			refs: ["1", "2", "3"],
			notes: [
				"1. 상태 말고는 덜어냈다.",
				"2. 상태는 색 대신 글자로 적었다.",
				"3. 처음 판은 정적 사이트 생성기로 만들었다.",
			],
		});
		await save();
		await saveCell("저장됨");
		const blocks = await kept(story.loaded());
		expect(blocks.filter((block) => block.type === "footnote")).toHaveLength(3);
		expect(blocks[0]?.content?.some((part) => part.type === "footnoteRef")).toBe(true);
	});

	it("a footnote's number taken out of the text: the footnote goes with it, and the rest are renumbered", async () => {
		await on("footnotes").run();
		await opened();
		await expect.poll(() => notes().refs).toEqual(["1", "2"]);
		// The first number ends its line: a press just past it puts the caret after it.
		const ref = within("[data-footnote-ref]")[0];
		const line = ref?.parentElement;
		if (!ref || !line) throw new Error("no footnote reference");
		const [at, box] = [ref.getBoundingClientRect(), line.getBoundingClientRect()];
		await userEvent.click(page.elementLocator(line), {
			position: { x: at.right + 6 - box.left, y: at.top + at.height / 2 - box.top },
		});
		await userEvent.keyboard("{Backspace}");
		await expect.poll(notes).toEqual({ refs: ["1"], notes: ["1. 처음 판은 정적 사이트 생성기로 만들었다."] });
	});

	it("a reference's number pressed: the caret goes to its footnote", async () => {
		await on("footnotes").run();
		await opened();
		await expect.poll(() => notes().refs).toEqual(["1", "2"]);
		const ref = within("[data-footnote-ref]")[0];
		if (!ref) throw new Error("no footnote reference");
		await userEvent.click(page.elementLocator(ref));
		await expect
			.poll(() =>
				document.getSelection()?.anchorNode?.parentElement?.closest("[data-footnote]")?.getAttribute("data-n"),
			)
			.toBe("1");
	});
});

describe("the entry editor: the assistant's proposals in the body (T32)", () => {
	const proposals = () =>
		story.loaded().site.monti.run("proposals.forTarget", { kind: "entry", id: story.loaded().id }, entry.admin);
	let story = on("proposed");
	async function proposed() {
		story = on("proposed");
		await story.run();
		await opened();
		await expect.poll(() => within("ins")).toHaveLength(2);
	}

	it("⌘↵ takes the proposal looked at: the words change, the change is unsaved, and the save marks the proposal applied", async () => {
		await proposed();
		await userEvent.click(title());
		await userEvent.click(body());
		await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
		await expect.poll(() => body().element().textContent).toContain("블로그를 다시 만든 건");
		expect(within("ins")).toHaveLength(1);
		await saveCell("저장 전 변경사항");
		await save();
		await saveCell("저장됨");
		expect(await proposals()).toHaveLength(2);
	});

	it("'모두 받기' puts every proposal into the text at once, unsaved", async () => {
		await proposed();
		await userEvent.click(button("모두 받기"));
		await expect.poll(() => body().element().textContent).toContain("상태도 색 대신 글자로 적었다.");
		const text = body().element().textContent;
		expect(text).toContain("블로그를 다시 만든 건");
		expect(text).not.toContain("편집기도 같은 원칙으로");
		expect(within("ins, del")).toHaveLength(0);
		await saveCell("저장 전 변경사항");
	});

	it("typing in a block a proposal touches takes that proposal first, then the typing goes over it", async () => {
		await proposed();
		await caretAfter(body().element(), "때문이다");
		await userEvent.keyboard("!");
		await expect.poll(() => body().element().textContent).toContain("블로그를 다시 만든 건");
		expect(body().element().textContent).toContain("때문이다!");
	});

	it("'모두 버리기': the proposals are gone from the text and the bubble with them; nothing changed", async () => {
		await proposed();
		await userEvent.click(button("모두 버리기"));
		await expect.poll(() => within("ins, del")).toHaveLength(0);
		await expect.element(button("모두 받기")).not.toBeInTheDocument();
		await saveCell("저장됨");
	});
});
