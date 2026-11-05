import type { Doc } from "@monti-cms/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { type StorySite, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { schema } from "../story-schema";

type Loaded = { site: StorySite; id: string };
type Monti = StorySite["monti"];

const admin = { actor: "admin" } as const;
const wait = { timeout: 15000 };

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

type Kind = "draft" | "new" | "untitled" | "published" | "changed" | "archived";

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
	const made = (await monti.run(
		"entries.create",
		kind === "new"
			? { collection: "post", locale: "ko" }
			: {
					collection: "post",
					locale: "ko",
					title: kind === "untitled" ? "" : "첫 번째 글",
					...(kind === "untitled" ? {} : { slug: "first-post" }),
					values: { summary: "리액트로 블로그를 다시 만들며 덜어낸 것과 남긴 것." },
					doc: firstPost(),
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
	return id;
}

/** The site, the entry, and the admin's address on it. `kept` is input this browser kept from an earlier visit. */
const site = (kind: Kind, kept?: { version: number; mine: [string, unknown][] }) => [
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
		localStorage.removeItem("monti.lastScreen");
		for (const key of Object.keys(localStorage)) if (key.startsWith("monti.draft.")) localStorage.removeItem(key);
		if (kept)
			localStorage.setItem(
				`monti.draft.entry:${id}`,
				JSON.stringify({ ...kept, savedAt: "2026-10-26T01:12:00.000Z", accepted: [] }),
			);
		window.history.replaceState(null, "", `#/c/post/${id}`);
		return { site: made, id };
	},
];

const meta = {
	tags: ["visual"],
	title: "Screens/Entry/Editor",
	render: (_args, { loaded }) => <MontiAdmin transport={(loaded as Loaded).site.transport} siteName="example.dev" />,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The save cell's words (a live region repeats them for screen readers, so the text is found twice). */
const saveCell = (page: ReturnType<typeof within>, text: string) =>
	page.findByText(text, { selector: "[data-slot=status-bar-cell]" }, wait);

/** Waits for the editor: its title and body. */
async function opened(canvasElement: HTMLElement) {
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
		await expect(page.queryByText("로그인이 풀렸어요")).toBeNull();
		await expect(page.queryByText("이 브라우저에 저장하지 않은 편집이 있어요")).toBeNull();
		await userEvent.click(page.getByRole("button", { name: "저장 전 변경사항" }));
		await saveCell(page, "저장됨");
	},
};

/** Selects words in the body the way a drag does, so the format card shows. */
async function select(body: HTMLElement, words: string) {
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
