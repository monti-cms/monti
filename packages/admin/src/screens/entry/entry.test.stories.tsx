import type { Doc } from "@monti-cms/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { StorySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import {
	admin,
	BrowserCopy,
	cells,
	fitsBody,
	inCell,
	notes,
	opened,
	SignedOut,
	saveCell,
	select,
	shares,
	site,
	TableColumnMenu,
	wait,
} from "./entry.stories";

type Loaded = { site: StorySite; id: string };

/** What only a play checks: that an action works. Kept out of the screens a person reviews (2026-11-06 owner). */
const meta = {
	tags: ["test"],
	title: "Tests/Entry/Editor",
	render: (_args, { loaded }) => <MontiAdmin transport={(loaded as Loaded).site.transport} siteName="example.dev" />,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** ⌘S: the save cell turns to "saved" (flow 1, step 09). */
export const Saved: Story = {
	loaders: site("draft"),
	play: async ({ canvasElement }) => {
		const { page, title } = await opened(canvasElement);
		await userEvent.type(title, " 다시 쓰기");
		await userEvent.keyboard("{Meta>}s{/Meta}");
		await saveCell(page, "저장됨");
		await expect(title).toHaveValue("첫 번째 글 다시 쓰기");
	},
};

/** A to-do row takes the cursor to its place: the empty title. */
export const TodoGoesThere: Story = {
	loaders: site("untitled"),
	play: async ({ canvasElement }) => {
		const { page, title, all } = await opened(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "할 일 2" }, wait));
		await userEvent.click(await all.findByRole("button", { name: /제목 쓰기/ }, wait));
		await waitFor(() => expect(title).toHaveFocus());
	},
};

/** The kept input beside the server's copy (flow 1, step 19). */
export const CompareBrowserCopy: Story = {
	loaders: site("draft", {
		version: 1,
		mine: [
			["title", "첫 번째 글 — 고쳐 쓰는 중"],
			["values.summary", "브라우저에만 남은 요약."],
		],
	}),
	play: async (context) => {
		await BrowserCopy.play?.(context);
		const page = within(context.canvasElement);
		await userEvent.click(page.getByRole("button", { name: "비교하기" }));
		await page.findByText("임시 저장본과 비교", {}, wait);
		await page.findByText(/다른 곳 \d/, {}, wait);
	},
};

/**
 * "다시 로그인": to the login screen and back. The address brings back the same entry, and what was typed goes back in by itself, ready to save
 * (doc 15, T39).
 */
export const SignedInAgain: Story = {
	loaders: site("draft"),
	play: async (context) => {
		await SignedOut.play?.(context);
		const page = within(context.canvasElement);
		await userEvent.click(page.getByRole("button", { name: "다시 로그인" }));
		await userEvent.type(await page.findByLabelText("이메일", {}, wait), "me@example.dev");
		await userEvent.type(page.getByLabelText("비밀번호"), "story password");
		await userEvent.click(page.getByRole("button", { name: "로그인" }));
		const title = await page.findByRole("textbox", { name: "제목" }, wait);
		await waitFor(() => expect(title).toHaveValue("첫 번째 글 다시 쓰기"), wait);
		await expect(page.queryByText("로그인이 풀렸습니다")).toBeNull();
		await expect(page.queryByText("이 브라우저에 저장하지 않은 편집이 있습니다")).toBeNull();
		await userEvent.click(page.getByRole("button", { name: "저장 전 변경사항" }));
		await saveCell(page, "저장됨");
	},
};

/** An address typed: one row, and it links out. */
export const LinkAddress: Story = {
	loaders: site("draft"),
	play: async ({ canvasElement }) => {
		const { body, all } = await opened(canvasElement);
		await select(body, "지금 상태만");
		await userEvent.click(await all.findByRole("button", { name: "링크" }, wait));
		await userEvent.type(await all.findByPlaceholderText("주소를 붙여 넣거나 글 찾기", {}, wait), "react.dev/learn");
		await all.findByRole("option", { name: /react\.dev\/learn/ }, wait);
	},
};

/** "/" and "표": an empty table goes in, three columns under a head row, the caret in its first cell (T62). */
export const TableInsert: Story = {
	loaders: site("new"),
	play: async ({ canvasElement }) => {
		const { body, all } = await opened(canvasElement);
		await userEvent.click(body);
		await userEvent.keyboard("/표");
		await userEvent.click(await all.findByRole("option", { name: /^표/ }, wait));
		await waitFor(() => expect(body.querySelectorAll("th")).toHaveLength(3), wait);
		await expect(body.querySelectorAll("tr")).toHaveLength(3);
		await userEvent.keyboard("버전");
		await expect(body.querySelector("th")?.textContent).toBe("버전");
		await all.findByRole("button", { name: "1번째 열" }, wait);
	},
};

/** A column put in from the menu: the table has four columns, and the save keeps it as rows of text. */
export const TableAddColumn: Story = {
	loaders: site("table"),
	play: async (context) => {
		await TableColumnMenu.play?.(context);
		const { page, body, all } = await opened(context.canvasElement);
		await userEvent.click(await all.findByRole("menuitem", { name: "오른쪽에 열 넣기" }, wait));
		await waitFor(() => expect(cells(body)[0]).toEqual(["버전", "바뀐 것", "", "날짜"]), wait);
		await expect(fitsBody(body)).toBe(true);
		await userEvent.keyboard("{Meta>}s{/Meta}");
		await saveCell(page, "저장됨");
		const { site: made, id } = context.loaded as Loaded;
		const read = (await made.monti.run("entries.get", { id }, admin)) as { entry: { doc: Doc } };
		const table = read.entry.doc.blocks.find((block) => block.type === "table");
		await expect(table?.attrs?.rows).toEqual([
			["버전", "바뀐 것", "", "날짜"],
			["1.0", "처음 공개", "", "2024-03-02"],
			["2.0", "편집기 다시 만들기", "", "2025-11-20"],
		]);
		await expect(table?.attrs?.header).toBe(true);
	},
};

/** A table whose columns were sized: each keeps its share of the body (20 · 50 · 30), and the table is as wide as the body. */
export const TableSized: Story = {
	loaders: site("tableSized"),
	play: async ({ canvasElement }) => {
		const { body } = await opened(canvasElement);
		await waitFor(() => expect(shares(body)).toEqual(["20%", "50%", "30%"]), wait);
		await expect(fitsBody(body)).toBe(true);
	},
};

/** A column put into a sized table: it gets an even share and the others make room in proportion; the table is still the body's width. */
export const TableSizedAddColumn: Story = {
	loaders: site("tableSized"),
	play: async ({ canvasElement }) => {
		const { body, all } = await opened(canvasElement);
		await inCell(body, "편집기 다시 만들기");
		await userEvent.click(await all.findByRole("button", { name: "2번째 열" }, wait));
		await userEvent.click(await all.findByRole("menuitem", { name: "오른쪽에 열 넣기" }, wait));
		await waitFor(() => expect(shares(body)).toEqual(["15%", "37.5%", "25%", "22.5%"]), wait);
		await expect(fitsBody(body)).toBe(true);
	},
};

/** A border dragged: only the two columns beside it trade width, and the table stays the body's width. */
export const TableDragBorder: Story = {
	loaders: site("tableSized"),
	play: async ({ canvasElement }) => {
		const { body, all } = await opened(canvasElement);
		await inCell(body, "처음 공개");
		const border = await all.findByRole("button", { name: "1·2번째 열 너비" }, wait);
		const box = border.getBoundingClientRect();
		const y = box.top + box.height / 2;
		const x = box.left + box.width / 2;
		const width = body.querySelector("table")?.getBoundingClientRect().width ?? 680;
		await userEvent.pointer([
			{ keys: "[MouseLeft>]", target: border, coords: { clientX: x, clientY: y } },
			{ target: border, coords: { clientX: x + width * 0.1, clientY: y } },
			{ keys: "[/MouseLeft]", target: border, coords: { clientX: x + width * 0.1, clientY: y } },
		]);
		await waitFor(() => expect(shares(body)).toEqual(["30%", "40%", "30%"]), wait);
		await expect(fitsBody(body)).toBe(true);
	},
};

/** Words picked and "Note¹" pressed: a number after them, its footnote at the end with the caret in it, the others renumbered; the save keeps both. */
export const FootnoteAdd: Story = {
	loaders: site("footnotes"),
	play: async (context) => {
		const { page, body, all } = await opened(context.canvasElement);
		await select(body, "지금 상태만");
		await userEvent.click(await all.findByRole("button", { name: "각주" }, wait));
		await userEvent.keyboard("상태 말고는 덜어냈다.");
		await waitFor(
			() =>
				expect(notes(body)).toEqual({
					refs: ["1", "2", "3"],
					notes: [
						"1. 상태 말고는 덜어냈다.",
						"2. 상태는 색 대신 글자로 적었다.",
						"3. 처음 판은 정적 사이트 생성기로 만들었다.",
					],
				}),
			wait,
		);
		await userEvent.keyboard("{Meta>}s{/Meta}");
		await saveCell(page, "저장됨");
		const { site: made, id } = context.loaded as Loaded;
		const read = (await made.monti.run("entries.get", { id }, admin)) as { entry: { doc: Doc } };
		const kept = read.entry.doc.blocks;
		await expect(kept.filter((block) => block.type === "footnote")).toHaveLength(3);
		await expect(kept[0]?.content?.some((part) => part.type === "footnoteRef")).toBe(true);
	},
};

/** A footnote's number taken out of the text: the footnote goes with it, and the rest are renumbered. */
export const FootnoteRemove: Story = {
	loaders: site("footnotes"),
	play: async ({ canvasElement }) => {
		const { body } = await opened(canvasElement);
		// The caret just after the first number, at the end of its line.
		const line = body.querySelector("[data-footnote-ref]")?.parentElement;
		if (!line) throw new Error("no footnote reference");
		body.focus();
		document.getSelection()?.collapse(line, line.childNodes.length);
		document.dispatchEvent(new Event("selectionchange"));
		await userEvent.keyboard("{Backspace}");
		await waitFor(
			() => expect(notes(body)).toEqual({ refs: ["1"], notes: ["1. 처음 판은 정적 사이트 생성기로 만들었다."] }),
			wait,
		);
	},
};

/** A reference's number pressed: the caret goes to its footnote. */
export const FootnoteGoTo: Story = {
	loaders: site("footnotes"),
	play: async ({ canvasElement }) => {
		const { body } = await opened(canvasElement);
		const ref = body.querySelector("[data-footnote-ref]");
		if (!ref) throw new Error("no footnote reference");
		// The editor reads a press by where it is, so the press needs its place.
		const box = ref.getBoundingClientRect();
		await userEvent.pointer({
			keys: "[MouseLeft]",
			target: ref,
			coords: { clientX: box.left + box.width / 2, clientY: box.top + box.height / 2 },
		});
		await waitFor(() => {
			const at = document.getSelection()?.anchorNode;
			expect(at?.parentElement?.closest("[data-footnote]")?.getAttribute("data-n")).toBe("1");
		}, wait);
	},
};

/** ⌘↵ takes the proposal looked at: the words change, the change is unsaved, and the save marks the proposal applied. */
export const BodyProposalTake: Story = {
	loaders: site("proposed"),
	play: async (context) => {
		const { page, body } = await opened(context.canvasElement);
		await waitFor(() => expect(body.querySelectorAll("ins")).toHaveLength(2), wait);
		await userEvent.keyboard("{Meta>}{Enter}{/Meta}");
		await waitFor(() => expect(body.textContent).toContain("블로그를 다시 만든 건"), wait);
		await expect(body.querySelectorAll("ins")).toHaveLength(1);
		await saveCell(page, "저장 전 변경사항");
		await userEvent.keyboard("{Meta>}s{/Meta}");
		await saveCell(page, "저장됨");
		const { site: made, id } = context.loaded as Loaded;
		const left = (await made.monti.run("proposals.forTarget", { kind: "entry", id }, admin)) as unknown[];
		await expect(left).toHaveLength(2);
	},
};

/** "모두 받기": every proposal goes into the text at once, unsaved. */
export const BodyProposalTakeAll: Story = {
	loaders: site("proposed"),
	play: async ({ canvasElement }) => {
		const { page, body, all } = await opened(canvasElement);
		await userEvent.click(await all.findByRole("button", { name: "모두 받기" }, wait));
		await waitFor(() => expect(body.textContent).toContain("상태도 색 대신 글자로 적었다."), wait);
		await expect(body.textContent).toContain("블로그를 다시 만든 건");
		await expect(body.textContent).not.toContain("편집기도 같은 원칙으로");
		await expect(body.querySelectorAll("ins, del")).toHaveLength(0);
		await saveCell(page, "저장 전 변경사항");
	},
};

/** Typing in a block a proposal touches takes that proposal first, then the typing goes over it. */
export const BodyProposalTypeIn: Story = {
	loaders: site("proposed"),
	play: async ({ canvasElement }) => {
		const { body } = await opened(canvasElement);
		await waitFor(() => expect(body.querySelectorAll("ins")).toHaveLength(2), wait);
		await select(body, "때문이다");
		document.getSelection()?.collapseToEnd();
		document.dispatchEvent(new Event("selectionchange"));
		await userEvent.keyboard("!");
		await waitFor(() => expect(body.textContent).toContain("블로그를 다시 만든 건"), wait);
		await expect(body.textContent).toContain("때문이다!");
	},
};

/** "모두 버리기": the proposals are gone from the text and the bubble with them; nothing changed. */
export const BodyProposalDiscardAll: Story = {
	loaders: site("proposed"),
	play: async ({ canvasElement }) => {
		const { page, body, all } = await opened(canvasElement);
		await userEvent.click(await all.findByRole("button", { name: "모두 버리기" }, wait));
		await waitFor(() => expect(body.querySelectorAll("ins, del")).toHaveLength(0), wait);
		await expect(all.queryByRole("button", { name: "모두 받기" })).toBeNull();
		await saveCell(page, "저장됨");
	},
};

/** "/" in the middle of a sentence opens the menu too (as Notion): "/각주" puts a footnote's number right there. */
export const SlashMidSentence: Story = {
	loaders: site("draft"),
	play: async ({ canvasElement }) => {
		const { body, all } = await opened(canvasElement);
		await select(body, "지금 상태만");
		document.getSelection()?.collapseToEnd();
		document.dispatchEvent(new Event("selectionchange"));
		await userEvent.keyboard("/각주");
		await all.findByRole("option", { name: /각주/ }, wait);
		await userEvent.keyboard("{Enter}");
		await waitFor(() => expect(body.querySelectorAll("[data-footnote]")).toHaveLength(1), wait);
		const line = body.querySelector("[data-footnote-ref]")?.parentElement?.textContent;
		await expect(line).toBe("목록에는 제목과 주소, 지금 상태만 남겼다. 나머지는 필요할 때 꺼내 본다.");
	},
};

/** The right + strip sits outside the body: the pointer leaves the body on its way there, and the strip stays to be pressed. */
export const TableAddColumnFromEdge: Story = {
	loaders: site("table"),
	play: async ({ canvasElement }) => {
		const { body, all } = await opened(canvasElement);
		const table = body.querySelector("table");
		if (!table) throw new Error("no table");
		const box = table.getBoundingClientRect();
		const y = box.top + 40;
		const outside = canvasElement.ownerDocument.body;
		await userEvent.pointer([
			{ target: table, coords: { clientX: box.right - 20, clientY: y } },
			{ target: outside, coords: { clientX: box.right + 2, clientY: y } },
		]);
		const strip = await all.findByRole("button", { name: "열 더하기" }, wait);
		await userEvent.pointer({ target: strip, coords: { clientX: box.right + 12, clientY: y } });
		await userEvent.click(strip);
		await waitFor(() => expect(cells(body)[0]).toHaveLength(4), wait);
	},
};
