import type { Doc } from "@monti-cms/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, within } from "storybook/test";
import { type StorySite, startAt, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { schema } from "../story-schema";

type Loaded = { site: StorySite };
type Monti = StorySite["monti"];

const meta = {
	excludeStories: /^[a-z]/,
	tags: ["visual"],
	title: "Screens/Tools/Templates",
	render: (_args, { loaded }) => <MontiAdmin transport={(loaded as Loaded).site.transport} siteName="example.dev" />,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const admin = { actor: "admin" } as const;
const wait = { timeout: 15000 };

let count = 0;
const text = (value: string) => [{ type: "text" as const, text: value }];
const p = (value: string) => ({ id: `b_${++count}`, type: "paragraph", content: text(value) });
const h = (value: string) => ({ id: `b_${++count}`, type: "heading", attrs: { level: 2 }, content: text(value) });
const list = (...items: string[]) => ({
	id: `b_${++count}`,
	type: "bulletList",
	children: items.map((item) => ({ id: `b_${++count}`, type: "listItem", content: text(item) })),
});
const doc = (...blocks: Doc["blocks"]): Doc => ({ type: "doc", blocks });

/** The reference screens' three templates (Lists › Templates, Editor › TemplateEditor). */
async function setup(monti: Monti) {
	await monti.run(
		"templates.save",
		{
			name: "기본 글",
			doc: doc(
				h("서론"),
				p("이 글에서 무엇을 다루는지 한두 문장으로."),
				h("본론"),
				list("첫 번째 요점", "두 번째 요점"),
				h("결론"),
				p("한 줄 요약과 다음에 읽을 글."),
			),
		},
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

const site = ({ empty = false } = {}) => [
	async () => {
		startAt();
		return {
			site: await storySite({ schema, auth: { password: true }, signedIn: true, setup: empty ? undefined : setup }),
		};
	},
];

/** Opens tools from the sidebar and waits for the templates. */
async function tools(canvasElement: HTMLElement) {
	const page = within(canvasElement);
	await userEvent.click(await page.findByRole("button", { name: "도구" }, wait));
	await page.findByRole("button", { name: "기본 글" }, wait);
	return { page, body: within(canvasElement.ownerDocument.body) };
}

/** Opens "기본 글" in the template editor and waits for its body. */
async function editor(canvasElement: HTMLElement) {
	const screen = await tools(canvasElement);
	await userEvent.click(screen.page.getByRole("button", { name: "기본 글" }));
	const text = await screen.page.findByRole("textbox", { name: "본문" }, wait);
	await within(text).findByText("첫 번째 요점", {}, wait);
	return { ...screen, text };
}

/** Points at a block, as the mouse does, so its handle shows. */
const pointAt = (element: Element) => {
	const rect = element.getBoundingClientRect();
	fireEvent.mouseMove(element, { clientX: rect.left + 8, clientY: rect.top + 8 });
};

/** Selects words in the text the way a drag does. The words may run over several pieces of one block (a bold part and a plain part). */
async function select(text: HTMLElement, words: string) {
	const pieces: Text[] = [];
	const walker = document.createTreeWalker(text, NodeFilter.SHOW_TEXT);
	for (let node = walker.nextNode(); node; node = walker.nextNode()) pieces.push(node as Text);
	for (const block of new Set(pieces.map((piece) => piece.parentElement?.closest("p, li, h2")))) {
		const inBlock = pieces.filter((piece) => piece.parentElement?.closest("p, li, h2") === block);
		const at = inBlock
			.map((piece) => piece.data)
			.join("")
			.indexOf(words);
		if (at < 0) continue;
		const find = (offset: number): [Text, number] => {
			let left = offset;
			for (const piece of inBlock) {
				if (left <= piece.data.length) return [piece, left];
				left -= piece.data.length;
			}
			throw new Error("past the block");
		};
		text.focus();
		const range = document.createRange();
		range.setStart(...find(at));
		range.setEnd(...find(at + words.length));
		const selection = document.getSelection();
		selection?.removeAllRanges();
		selection?.addRange(range);
		document.dispatchEvent(new Event("selectionchange"));
		return;
	}
	throw new Error(`no text "${words}"`);
}

/** Tools › Templates: each template with its sections, the day it was changed and its ⋯. */
export const Templates: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page } = await tools(canvasElement);
		await expect(await page.findByText("한 줄 평 · 줄거리 · 인용 · 생각")).toBeVisible();
	},
};

/** No templates yet: one quiet line; the way to start is the header's pill. */
export const NoTemplates: Story = {
	loaders: site({ empty: true }),
	play: async ({ canvasElement }) => {
		const page = within(canvasElement);
		await userEvent.click(await page.findByRole("button", { name: "도구" }, wait));
		await page.findByText("아직 템플릿이 없습니다.", {}, wait);
	},
};

/** TemplateEditor: "기본 글" with its name as the title and its blocks. */
export const TemplateEditor: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page } = await editor(canvasElement);
		await expect(page.getByRole("textbox", { name: "템플릿 이름" })).toHaveValue("기본 글");
	},
};

/** The handle beside a list item and its block menu, with "다른 블록으로 바꾸기" open (flow 1, steps 03–04). */
export const BlockMenu: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { text, body } = await editor(canvasElement);
		pointAt(await within(text).findByText("첫 번째 요점"));
		await userEvent.click(await body.findByRole("button", { name: "블록 메뉴" }, wait));
		await userEvent.click(await body.findByRole("menuitem", { name: /다른 블록으로 바꾸기/ }, wait));
		await body.findByRole("menuitemradio", { name: /제목 3/ }, wait);
	},
};

/** The format card over selected words that are bold and italic: those two pressed, and "서식 지우기" after the text formats (flow 1, step 03). */
export const FormatCard: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { text, body } = await editor(canvasElement);
		await select(text, "무엇을 다루는지");
		await body.findByRole("toolbar", { name: "서식" }, wait);
		await userEvent.click(body.getByRole("button", { name: "굵게" }));
		await userEvent.click(body.getByRole("button", { name: "기울임" }));
		await body.findByRole("button", { name: "서식 지우기" }, wait);
	},
};

/** A new template: no name yet, the empty body's one line says how to add a block. Saving without a name says so under the name. */
export const NewTemplate: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page } = await tools(canvasElement);
		await userEvent.click(page.getByRole("button", { name: "템플릿 추가" }));
		await page.findByRole("textbox", { name: "본문" }, wait);
		await userEvent.click(page.getByRole("button", { name: "저장" }));
		await page.findByText("이름을 써 주세요.");
	},
};

/** Mid-drag: "서론" in hand over the list, its place left as a gap, the line between the two points where it lands (the list will be cut there). */
export const Dragging: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { text, body } = await editor(canvasElement);
		pointAt(await within(text).findByText("서론"));
		const grip = (await body.findByRole("button", { name: "블록 메뉴" }, wait)).getBoundingClientRect();
		const x = grip.left + grip.width / 2;
		const y = grip.top + grip.height / 2;
		fireEvent.pointerDown(body.getByRole("button", { name: "블록 메뉴" }), { button: 0, clientX: x, clientY: y });
		const first = (await within(text).findByText("첫 번째 요점")).getBoundingClientRect();
		for (const to of [y + 10, first.top + 4, first.bottom - 4])
			window.dispatchEvent(new PointerEvent("pointermove", { clientX: x + 8, clientY: to }));
		await body.findByText("서론", { selector: "[data-slot=held-block] span" }, wait);
	},
};

/** The block menu of a paragraph with "정렬" open: left, center, right (flow 1, step 05). */
export const AlignMenu: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { text, body } = await editor(canvasElement);
		pointAt(await within(text).findByText("이 글에서 무엇을 다루는지 한두 문장으로."));
		await userEvent.click(await body.findByRole("button", { name: "블록 메뉴" }, wait));
		await userEvent.click(await body.findByRole("menuitem", { name: /정렬/ }, wait));
		await body.findByRole("menuitemradio", { name: /가운데/ }, wait);
	},
};
