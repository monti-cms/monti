import type { Doc } from "@monti-cms/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { type StorySite, storySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { schema } from "../story-schema";

type Loaded = { site: StorySite };
type Monti = StorySite["monti"];

const meta = {
	tags: ["visual"],
	title: "Screens/Tools/Templates",
	render: (_args, { loaded }) => <MontiAdmin transport={(loaded as Loaded).site.transport} siteName="example.dev" />,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const admin = { actor: "admin" } as const;
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
	async () => ({
		site: await storySite({ schema, auth: { password: true }, signedIn: true, setup: empty ? undefined : setup }),
	}),
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

/** Selects words in the text the way a drag does. */
async function select(text: HTMLElement, words: string) {
	const node = [...text.querySelectorAll("p, li, h2")].find((each) => each.textContent?.includes(words));
	const textNode = node?.firstChild;
	if (!textNode) throw new Error(`no text "${words}"`);
	const start = textNode.textContent?.indexOf(words) ?? 0;
	text.focus();
	const range = document.createRange();
	range.setStart(textNode, start);
	range.setEnd(textNode, start + words.length);
	const selection = document.getSelection();
	selection?.removeAllRanges();
	selection?.addRange(range);
	document.dispatchEvent(new Event("selectionchange"));
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
		await page.findByText("아직 템플릿이 없어요.", {}, wait);
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

/** The "/" menu under a "/" typed on an empty line (flow 1, step 02). */
export const SlashMenu: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { text, body } = await editor(canvasElement);
		pointAt(await within(text).findByText("한 줄 요약과 다음에 읽을 글."));
		await userEvent.click(await body.findByRole("button", { name: "아래에 블록 넣기" }, wait));
		await body.findByRole("listbox", { name: "블록" }, wait);
	},
};

/** The format card over selected words (flow 1, step 03). */
export const FormatCard: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { text, body } = await editor(canvasElement);
		await select(text, "무엇을 다루는지");
		await body.findByRole("toolbar", { name: "서식" }, wait);
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

/** The template was saved elsewhere since it was opened: the save is refused and the banner offers the latest. */
export const SavedElsewhere: Story = {
	loaders: site(),
	play: async ({ canvasElement, loaded }) => {
		const { page } = await editor(canvasElement);
		const { monti } = (loaded as Loaded).site;
		// A read answers with its output.
		const listed = (await monti.run("templates.list", {}, admin)) as { id: string; version: number }[];
		const first = listed[0];
		const saved = (await monti.run("templates.get", { id: first?.id }, admin)) as { doc: Doc };
		await monti.run(
			"templates.save",
			{ id: first?.id, version: first?.version, name: "기본 글 (다른 탭)", doc: saved.doc },
			admin,
		);
		fireEvent.change(page.getByRole("textbox", { name: "템플릿 이름" }), { target: { value: "기본 글 고침" } });
		await userEvent.click(page.getByRole("button", { name: "저장" }));
		await page.findByText("다른 곳에서 먼저 저장했어요", {}, wait);
		await waitFor(() => expect(page.getByText("저장 안 됨")).toBeVisible());
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
		await body.findByText("서론", { selector: "[data-slot=held-block] h2" }, wait);
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
