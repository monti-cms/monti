import type { Doc } from "@monti-cms/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { type StorySite, startAt, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { schema } from "../story-schema";

type Loaded = { site: StorySite; id: string };
type Monti = StorySite["monti"];

export const admin = { actor: "admin" } as const;
export const wait = { timeout: 15000 };

let count = 0;
const text = (value: string) => [{ type: "text" as const, text: value }];
const p = (value: string) => ({ id: `b_${++count}`, type: "paragraph", content: text(value) });
const h = (value: string) => ({ id: `b_${++count}`, type: "heading", attrs: { level: 2 }, content: text(value) });
const doc = (...blocks: Doc["blocks"]): Doc => ({ type: "doc", blocks });

/** The reference screen's entry (Editor › EditorNotion). */
const firstPost = () =>
	doc(
		p("블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다."),
		h("무엇을 덜어냈나"),
		p("목록에는 제목과 주소, 지금 상태만 남겼다. 나머지는 필요할 때 꺼내 본다."),
		p("편집기도 같은 원칙으로 정리했다. 글을 쓰는 동안 보이는 건 글뿐이다."),
	);

/** An entry with a table (T62): versions and what changed, the first row its head row. */
const changelog = (widths?: number[]) =>
	doc(
		p("버전마다 무엇이 바뀌었는지 적어 둔다."),
		{
			id: `b_${++count}`,
			type: "table",
			attrs: {
				header: true,
				rows: [
					["버전", "바뀐 것", "날짜"],
					["1.0", "처음 공개", "2024-03-02"],
					["2.0", "편집기 다시 만들기", "2025-11-20"],
				],
				...(widths ? { widths } : {}),
			},
		},
		p("다음 버전은 아직 정하지 않았다."),
	);

/** An entry with two footnotes, stored out of order: "처음" is noted second in the text but kept first (T62). */
const noted = () =>
	doc(
		{
			id: `b_${++count}`,
			type: "paragraph",
			content: [
				{ type: "text", text: "목록에는 지금 상태만 남겼다." },
				{ type: "footnoteRef", id: "fn_state" },
			],
		},
		{
			id: `b_${++count}`,
			type: "footnote",
			attrs: { id: "fn_first" },
			content: text("처음 판은 정적 사이트 생성기로 만들었다."),
		},
		{
			id: `b_${++count}`,
			type: "paragraph",
			content: [
				{ type: "text", text: "처음 만든 건 2019년이다." },
				{ type: "footnoteRef", id: "fn_first" },
			],
		},
		{ id: `b_${++count}`, type: "footnote", attrs: { id: "fn_state" }, content: text("상태는 색 대신 글자로 적었다.") },
	);

/**
 * The assistant's body proposals on the reference entry (T32), from one request: a shorter phrase in the first paragraph, a line put in after the
 * third, and the last paragraph taken out.
 */
async function proposeBody(monti: Monti, id: string) {
	const read = (await monti.run("entries.get", { id }, admin)) as { entry: { doc: Doc; version: number } };
	const [first, , third, last] = read.entry.doc.blocks;
	if (!first || !third || !last) throw new Error("the reference entry has four blocks");
	const proposal = await monti.proposals.create("conversation-1", "더 짧게 다듬기");
	const edit = (ops: unknown[]) => monti.proposals.add(proposal, "body.edit", { id, version: read.entry.version, ops });
	await edit([{ op: "replaceText", block: first.id, from: 8, to: 14, text: "만든" }]);
	await edit([
		{ op: "insert", after: third.id, blocks: [{ type: "paragraph", content: text("상태도 색 대신 글자로 적었다.") }] },
	]);
	await edit([{ op: "remove", blocks: [last.id] }]);
}

async function templates(monti: Monti) {
	await monti.run(
		"templates.save",
		{ name: "기본 글", doc: doc(h("서론"), p("이 글에서 무엇을 다루는지."), h("본론")) },
		admin,
	);
	await monti.run(
		"templates.save",
		{ name: "책 리뷰", doc: doc(h("한 줄 평"), h("줄거리"), h("인용"), h("생각")) },
		admin,
	);
	await monti.run(
		"templates.save",
		{ name: "튜토리얼", doc: doc(h("준비물"), h("단계"), h("코드"), h("마무리")) },
		admin,
	);
}

type Kind =
	| "draft"
	| "new"
	| "untitled"
	| "published"
	| "changed"
	| "archived"
	| "table"
	| "tableSized"
	| "footnotes"
	| "proposed";

/** Makes the story's entry and returns its id. */
async function entry(monti: Monti, kind: Kind): Promise<string> {
	await templates(monti);
	await monti.run(
		"collections.updateAdminValues",
		{
			collection: "post",
			values: {
				label: "게시글",
				fields: {
					title: { label: "제목" },
					slug: { label: "주소" },
					summary: { label: "요약" },
					subtitle: { label: "부제" },
					cover: { label: "대표 이미지" },
					category: { label: "카테고리" },
				},
			},
		},
		admin,
	);
	let devCategoryGroup = "";
	for (const [name, slug] of [
		["개발", "dev"],
		["일상", "life"],
		["회고", "retro"],
	] as const) {
		const cat = (await monti.run(
			"items.saveGroup",
			{ collection: "category", locales: { ko: { title: name, slug } } },
			admin,
		)) as { output: { group: string } };
		if (name === "개발") devCategoryGroup = cat.output.group;
	}
	const made = (await monti.run(
		"entries.create",
		kind === "new"
			? { collection: "post", locale: "ko" }
			: {
					collection: "post",
					locale: "ko",
					title: kind === "untitled" ? "" : "첫 번째 글",
					...(kind === "untitled" ? {} : { slug: "first-post" }),
					values: {
						summary: "리액트로 블로그를 다시 만들며 덜어낸 것과 남긴 것.",
						...(devCategoryGroup ? { category: devCategoryGroup } : {}),
					},
					doc:
						kind === "table"
							? changelog()
							: kind === "tableSized"
								? changelog([20, 50, 30])
								: kind === "footnotes"
									? noted()
									: firstPost(),
				},
		admin,
	)) as { output: { id: string } };
	const id = made.output.id;
	// Other entries a link can find (T63).
	for (const title of ["리액트 다시 만들기 1편 · 상태", "리액트 다시 만들기 2편 · 렌더링", "읽을 것"])
		await monti.run(
			"entries.create",
			{ collection: title === "읽을 것" ? "memo" : "post", locale: "ko", title },
			admin,
		);
	if (kind === "published" || kind === "changed")
		await monti.run("entries.publish", { ids: [id], date: "keep" }, admin);
	if (kind === "changed")
		await monti.run("entries.save", { id, version: 2, values: { subtitle: "도구보다 글" } }, admin);
	if (kind === "archived") await monti.run("entries.archive", { ids: [id] }, admin);
	if (kind === "proposed") await proposeBody(monti, id);
	return id;
}

/** The site, the entry, and the admin's address on it. `kept` is input this browser kept from an earlier visit. */
export const site = (kind: Kind, kept?: { version: number; mine: [string, unknown][] }) => [
	async (): Promise<Loaded> => {
		let id = "";
		const made = await storySite({
			schema,
			auth: { password: true },
			signedIn: true,
			setup: async (monti) => {
				id = await entry(monti, kind);
			},
		});
		startAt(`#/c/post/${id}`);
		if (kept)
			localStorage.setItem(
				`monti.draft.entry:${id}`,
				JSON.stringify({ ...kept, savedAt: "2026-10-26T01:12:00.000Z", accepted: [] }),
			);
		return { site: made, id };
	},
];

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Screens/Entry/Editor",
	render: (_args, { loaded }) => <MontiAdmin transport={(loaded as Loaded).site.transport} siteName="example.dev" />,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The save cell's words (a live region repeats them for screen readers, so the text is found twice). */
export const saveCell = (page: ReturnType<typeof within>, text: string) =>
	page.findByText(text, { selector: "[data-slot=status-bar-cell]" }, wait);

/** Waits for the editor: its title and body. */
export async function opened(canvasElement: HTMLElement) {
	const page = within(canvasElement);
	const title = await page.findByRole("textbox", { name: "제목" }, wait);
	const body = await page.findByRole("textbox", { name: "본문" }, wait);
	return { page, title, body, all: within(canvasElement.ownerDocument.body) };
}

/** A draft as one writes it: the properties beside it, saved, with nothing left to do. */
export const Draft: Story = {
	loaders: site("draft"),
	play: async ({ canvasElement }) => {
		const { page } = await opened(canvasElement);
		await saveCell(page, "저장됨");
		await expect(page.getByText("초안")).toBeVisible();
		await expect(page.getByRole("button", { name: "발행하기" })).toBeVisible();
	},
};

/** A new entry: no title, no body, nothing to preview yet (flow 1, step 02). */
export const NewEntry: Story = {
	loaders: site("new"),
	play: async ({ canvasElement }) => {
		const { page } = await opened(canvasElement);
		await expect(page.queryByRole("button", { name: "미리보기" })).toBeNull();
	},
};

/** "/" in a new entry's body: the templates are in the menu, put in where the cursor is (flow 1, step 02). */
export const SlashTemplates: Story = {
	loaders: site("new"),
	play: async ({ canvasElement }) => {
		const { body, all } = await opened(canvasElement);
		await userEvent.click(body);
		await userEvent.keyboard("/템플");
		await all.findByRole("option", { name: /책 리뷰/ }, wait);
	},
};

/** Typed and not saved: the save cell says so and saves when pressed (flow 1, step 03). */
export const Unsaved: Story = {
	loaders: site("draft"),
	play: async ({ canvasElement }) => {
		const { page, title } = await opened(canvasElement);
		await userEvent.type(title, " 다시 쓰기");
		await expect(await page.findByRole("button", { name: "저장 전 변경사항" })).toBeVisible();
	},
};

/** Publishing with something left to do: refused, and the to-do list opens on what blocks it (flow 1, step 10). */
export const PublishBlocked: Story = {
	loaders: site("untitled"),
	play: async ({ canvasElement }) => {
		const { page, all } = await opened(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "발행하기" }));
		await all.findByText("발행할 수 없어요 · 할 일 2개를 먼저 해 주세요", {}, wait);
		await all.findByRole("button", { name: /제목 쓰기/ }, wait);
	},
};

/** Published: the toast, with the way to see it on the site (flow 1, steps 13–14). */
export const Published: Story = {
	loaders: site("draft"),
	play: async ({ canvasElement }) => {
		const { page, all } = await opened(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "발행하기" }));
		await all.findByText("발행되었어요", {}, wait);
		await waitFor(() => expect(page.getByRole("button", { name: "발행됨" })).toBeDisabled(), wait);
	},
};

/** Changed after publishing: "changed", and the publish menu with the date kept or today's (flow 1, step 15). */
export const RepublishMenu: Story = {
	loaders: site("changed"),
	play: async ({ canvasElement }) => {
		const { page, all } = await opened(canvasElement);
		await page.findByText("수정 중", {}, wait);
		await userEvent.click(page.getByRole("button", { name: "발행 방식" }));
		await all.findByRole("menuitem", { name: /오늘 날짜로 다시 발행/ }, wait);
	},
};

/** Saved elsewhere first: the save is refused and the banner offers the comparison (flow 1, step 16). */
export const SavedElsewhere: Story = {
	loaders: site("draft"),
	play: async ({ canvasElement, loaded }) => {
		const { site: made, id } = loaded as Loaded;
		const { page, title } = await opened(canvasElement);
		await saveCell(page, "저장됨");
		await userEvent.type(title, " 다시 쓰기");
		await made.monti.run(
			"entries.save",
			{ id, version: 1, values: { summary: "다른 탭에서 고친 요약." }, title: "첫 번째 글 (다른 탭)" },
			admin,
		);
		await userEvent.keyboard("{Meta>}s{/Meta}");
		await page.findByText(/먼저 저장했어요/, {}, wait);
		await expect(page.getByRole("button", { name: "편집 충돌" })).toBeVisible();
	},
};

/** The comparison of my input and the latest save: the words that differ marked on both sides (flow 1, step 17). */
export const CompareConflict: Story = {
	loaders: site("draft"),
	play: async (context) => {
		await SavedElsewhere.play?.(context);
		const page = within(context.canvasElement);
		await userEvent.click(page.getByRole("button", { name: "비교하기" }));
		await page.findByText("서버 최신본과 비교", {}, wait);
		await page.findByText(/다른 곳 \d/, {}, wait);
	},
};

/** Opened again with input this browser kept: the banner asks what to do with it (flow 1, step 18). */
export const BrowserCopy: Story = {
	loaders: site("draft", {
		version: 1,
		mine: [
			["title", "첫 번째 글 — 고쳐 쓰는 중"],
			["values.summary", "브라우저에만 남은 요약."],
		],
	}),
	play: async ({ canvasElement }) => {
		const { page } = await opened(canvasElement);
		await page.findByText("이 브라우저에 저장하지 않은 편집이 있어요", {}, wait);
		await expect(page.getByRole("button", { name: "브라우저에만 임시 저장됨" })).toBeVisible();
	},
};

/** Archived: off the site and read-only; the head has only "unarchive" (doc 02, decisions). */
export const Archived: Story = {
	loaders: site("archived"),
	play: async ({ canvasElement }) => {
		const { page, title } = await opened(canvasElement);
		await page.findByRole("button", { name: "보관 풀기" }, wait);
		await expect(title).toBeDisabled();
		await expect(page.queryByRole("button", { name: "발행하기" })).toBeNull();
	},
};

/**
 * The session ended while writing: the save is refused, the banner stands at the top of the screen and the save cell says so (T39). The screen
 * stays, so a sentence can be finished first.
 */
export const SignedOut: Story = {
	loaders: site("draft"),
	play: async ({ canvasElement, loaded }) => {
		const { site: made } = loaded as Loaded;
		const { page, title, all } = await opened(canvasElement);
		await saveCell(page, "저장됨");
		await userEvent.type(title, " 다시 쓰기");
		await made.db.deleteFrom("monti_session").execute();
		await userEvent.keyboard("{Meta>}s{/Meta}");
		await expect(await page.findByRole("button", { name: "로그인이 풀렸어요" }, wait)).toBeVisible();
		await page.findByText("저장하지 않은 입력은 이 브라우저에 남아 있어요", {}, wait);
	},
};

/** Selects words in the body the way a drag does, so the format card shows. */
export async function select(body: HTMLElement, words: string) {
	const walker = document.createTreeWalker(body, NodeFilter.SHOW_TEXT);
	let textNode: Node | null = walker.nextNode();
	while (textNode && !textNode.textContent?.includes(words)) textNode = walker.nextNode();
	if (!textNode) throw new Error(`no text "${words}"`);
	const start = textNode.textContent?.indexOf(words) ?? 0;
	body.focus();
	const range = document.createRange();
	range.setStart(textNode, start);
	range.setEnd(textNode, start + words.length);
	const selection = document.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
	document.dispatchEvent(new Event("selectionchange"));
}

/** Words typed in the link card find the site's entries (T63). */
export const LinkSearch: Story = {
	loaders: site("draft"),
	play: async ({ canvasElement }) => {
		const { body, all } = await opened(canvasElement);
		await select(body, "지금 상태만");
		await userEvent.click(await all.findByRole("button", { name: "링크" }, wait));
		const field = await all.findByPlaceholderText("주소를 붙여 넣거나 글 찾기", {}, wait);
		await userEvent.type(field, "리액트");
		await all.findByRole("option", { name: /리액트 다시 만들기 2편/ }, wait);
	},
};

/** An entry picked: the words link to it, and the card opened on them again shows it with the way to take the link off. */
export const LinkedEntry: Story = {
	loaders: site("draft"),
	play: async (context) => {
		await LinkSearch.play?.(context);
		const all = within(context.canvasElement.ownerDocument.body);
		const { body } = await opened(context.canvasElement);
		await userEvent.click(await all.findByRole("option", { name: /리액트 다시 만들기 1편/ }, wait));
		await waitFor(() => expect(body.querySelector("a")).not.toBeNull(), wait);
		await select(body, "지금 상태만");
		fireEvent.click(await all.findByRole("button", { name: "링크" }, wait));
		await all.findByRole("option", { name: /링크 떼기/ }, wait);
		await all.findByText("지금 링크", {}, wait);
	},
};

/** Puts the caret at the end of a cell's text. */
export async function inCell(body: HTMLElement, words: string) {
	const cell = [...body.querySelectorAll("td, th")].find((each) => each.textContent === words);
	if (!cell) throw new Error(`no cell "${words}"`);
	await userEvent.click(cell);
	return cell;
}

/** The table's column widths as the editor draws them. */
export const shares = (body: HTMLElement) =>
	[...body.querySelectorAll("col")].map((col) => (col as HTMLElement).style.width);

/** The table is no wider than the body. */
export const fitsBody = (body: HTMLElement) => {
	const table = body.querySelector("table");
	return Boolean(table) && (table?.getBoundingClientRect().width ?? 0) <= body.getBoundingClientRect().width + 1;
};

/** The table's cells as rows of text. */
export const cells = (body: HTMLElement) =>
	[...body.querySelectorAll("tr")].map((row) => [...row.querySelectorAll("td, th")].map((cell) => cell.textContent));

/** The caret in a cell: a grip on its column's top edge and its row's left edge (T62). */
export const TableGrips: Story = {
	loaders: site("table"),
	play: async ({ canvasElement }) => {
		const { body, all } = await opened(canvasElement);
		await inCell(body, "편집기 다시 만들기");
		await all.findByRole("button", { name: "2번째 열" }, wait);
		await all.findByRole("button", { name: "3번째 행" }, wait);
	},
};

/** The column grip pressed: the column is picked whole and its menu is open. */
export const TableColumnMenu: Story = {
	loaders: site("table"),
	play: async ({ canvasElement }) => {
		const { body, all } = await opened(canvasElement);
		await inCell(body, "편집기 다시 만들기");
		await userEvent.click(await all.findByRole("button", { name: "2번째 열" }, wait));
		await all.findByRole("menuitem", { name: "오른쪽에 열 넣기" }, wait);
		await waitFor(() => expect(body.querySelectorAll(".selectedCell")).toHaveLength(3), wait);
	},
};

/** The pointer over the table: + strips on its right and bottom edges; the bottom one adds a row. */
export const TableAddRow: Story = {
	loaders: site("table"),
	play: async ({ canvasElement }) => {
		const { body, all } = await opened(canvasElement);
		const cell = await inCell(body, "처음 공개");
		await userEvent.hover(cell);
		await all.findByRole("button", { name: "열 더하기" }, wait);
		await userEvent.click(await all.findByRole("button", { name: "행 더하기" }, wait));
		await waitFor(() => expect(cells(body)).toHaveLength(4), wait);
	},
};

/** The table's block menu turns its head row off: the first row is a plain row. */
export const TableHeaderRow: Story = {
	loaders: site("table"),
	play: async ({ canvasElement }) => {
		const { body, all } = await opened(canvasElement);
		const table = body.querySelector("table");
		if (!table) throw new Error("no table");
		// The handle follows the line the pointer is on, so the move needs its place.
		const box = table.getBoundingClientRect();
		fireEvent.mouseMove(table, { clientX: box.left + 20, clientY: box.top + 10 });
		await userEvent.click(await all.findByRole("button", { name: "블록 메뉴" }, wait));
		await userEvent.click(await all.findByRole("menuitemcheckbox", { name: "머리 행" }, wait));
		await waitFor(() => expect(body.querySelectorAll("th")).toHaveLength(0), wait);
	},
};

/** The footnotes' numbers and texts, in the order the editor shows them. */
export const notes = (body: HTMLElement) => ({
	refs: [...body.querySelectorAll("[data-footnote-ref]")].map((ref) => ref.getAttribute("data-n")),
	notes: [...body.querySelectorAll("[data-footnote]")].map(
		(note) => `${note.getAttribute("data-n")}. ${note.textContent}`,
	),
});

/** Footnotes are numbered as their references come in the text, and sit together at the end in that order, whatever order they were kept in. */
export const FootnoteNumbers: Story = {
	loaders: site("footnotes"),
	play: async ({ canvasElement }) => {
		const { body } = await opened(canvasElement);
		await waitFor(
			() =>
				expect(notes(body)).toEqual({
					refs: ["1", "2"],
					notes: ["1. 상태는 색 대신 글자로 적었다.", "2. 처음 판은 정적 사이트 생성기로 만들었다."],
				}),
			wait,
		);
	},
};

/** The assistant's body proposals drawn over the text: struck-through words out, pale blue words in, the first looked at (T32). */
export const BodyProposals: Story = {
	loaders: site("proposed"),
	play: async ({ canvasElement }) => {
		const { body, all } = await opened(canvasElement);
		await waitFor(() => expect(body.querySelectorAll("ins")).toHaveLength(2), wait);
		await expect(body.querySelector("ins")?.textContent).toBe("만든");
		await all.findByText("더 짧게 다듬기", {}, wait);
		await all.findByRole("button", { name: "모두 받기" }, wait);
	},
};
