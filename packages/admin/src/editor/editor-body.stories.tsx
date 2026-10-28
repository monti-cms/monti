import type { StoredDocument } from "@monti-cms/core/document";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { type FakeApi, PageFrame } from "../stories/screen-frame";
import { docOf } from "../test/mdx";
import { CmsEditor } from "./tiptap-editor";

// The body of the post editor as the boards draw it (flow 1, steps 02 to 05): the "/" menu, the template list, the format card and the block menu. There is no
// toolbar over the body, so each story opens the part it shows by doing what a writer does.

const meta = {
	title: "Screens/Editor body",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const BODY =
	"블로그를 다시 만들기로 한 건 글을 쓰는 시간보다 도구를 고치는 시간이 길어졌기 때문이다.\n\n## 무엇을 덜어냈나\n\n목록에는 제목과 주소, 지금 상태만 남겼다. 나머지는 필요할 때 꺼내 본다.\n\n편집기도 같은 원칙으로 정리했다. 글을 쓰는 동안 보이는 건 글뿐이다.";

const stamp = "2026-10-20T00:00:00.000Z";
const templates = [
	{ name: "기본 글", sections: ["서론", "본론", "결론"] },
	{ name: "책 리뷰", sections: ["한 줄 평", "줄거리", "인용", "생각"] },
	{ name: "튜토리얼", sections: ["준비물", "단계", "코드", "마무리"] },
].map(({ name, sections }, index) => ({
	id: `template-${index}`,
	name,
	version: 1,
	createdAt: stamp,
	updatedAt: stamp,
	doc: {
		type: "doc",
		version: 3,
		content: sections.map((section, at) => ({
			type: "heading",
			id: `t${index}s${at}`,
			attrs: { level: 2 },
			content: [{ type: "text", text: section }],
		})),
	} satisfies StoredDocument,
}));
const api: FakeApi = (path) => (path.startsWith("/api/monti/v1/templates") ? { items: templates } : undefined);

function Body({ text }: { text: string }) {
	const [doc, setDoc] = useState(() => docOf(text));
	return (
		<PageFrame api={api}>
			<div className="flex h-[720px] flex-col">
				<CmsEditor
					doc={doc}
					onChange={setDoc}
					templates
					titleField={<h1 className="text-monti-display">{text ? "첫 번째 글" : "제목"}</h1>}
				/>
			</div>
		</PageFrame>
	);
}

const LONG = { timeout: 10000 };
const editorOf = async (canvasElement: HTMLElement) => {
	const root = within(canvasElement);
	await root.findByRole("textbox", { name: "본문 편집기" }, LONG);
	return canvasElement.querySelector(".ProseMirror") as HTMLElement;
};
const body = () => within(document.body);

/** A new post: one empty line that says how to start. */
export const NewPost: Story = {
	tags: ["visual"],
	render: () => <Body text="" />,
	play: async ({ canvasElement }) => {
		const editor = await editorOf(canvasElement);
		await waitFor(() => expect(editor.querySelector("[data-placeholder]")).toBeTruthy(), LONG);
	},
};

/** The "/" menu on a new line: groups for text, inserts and components, and the templates. */
export const SlashMenu: Story = {
	tags: ["visual"],
	render: () => <Body text="" />,
	play: async ({ canvasElement }) => {
		const editor = await editorOf(canvasElement);
		await userEvent.click(editor);
		await userEvent.keyboard("/");
		await body().findByRole("listbox", { name: "넣기" }, LONG);
		await body().findByText("템플릿 · 이 자리에 넣어요", undefined, LONG);
	},
};

/** Typing the group's name narrows the list to the templates. */
export const TemplatePicker: Story = {
	tags: ["visual"],
	render: () => <Body text="" />,
	play: async ({ canvasElement }) => {
		const editor = await editorOf(canvasElement);
		await userEvent.click(editor);
		await userEvent.keyboard("/템플릿");
		await body().findByRole("option", { name: /기본 글/ }, LONG);
	},
};

/** Selected words: the format card over them. */
export const FormatCard: Story = {
	tags: ["visual"],
	render: () => <Body text={BODY} />,
	play: async ({ canvasElement }) => {
		const editor = await editorOf(canvasElement);
		await userEvent.dblClick(within(editor).getByText(/필요할 때/));
		await body().findByRole("toolbar", { name: "인라인 서식" }, LONG);
	},
};

const openBlockMenu = async (canvasElement: HTMLElement) => {
	const editor = await editorOf(canvasElement);
	await userEvent.hover(within(editor).getByText(/블로그를 다시/));
	await userEvent.click(await body().findByRole("button", { name: "블록 메뉴" }, LONG));
	return body().findByRole("menu", { name: "블록 메뉴" }, LONG);
};

/** The block menu from the handle: the kind of block, turn into, align, move, duplicate, delete. */
export const BlockMenu: Story = {
	tags: ["visual"],
	render: () => <Body text={BODY} />,
	play: async ({ canvasElement }) => {
		await openBlockMenu(canvasElement);
	},
};

/** "다른 블록으로 바꾸기": the kinds, with the current one ticked. */
export const TurnInto: Story = {
	tags: ["visual"],
	render: () => <Body text={BODY} />,
	play: async ({ canvasElement }) => {
		await openBlockMenu(canvasElement);
		await userEvent.click(await body().findByRole("menuitem", { name: /다른 블록으로 바꾸기/ }, LONG));
		await body().findByRole("menuitemradio", { name: /제목 2/ }, LONG);
	},
};

/** "정렬": left, center and right. */
export const Align: Story = {
	tags: ["visual"],
	render: () => <Body text={BODY} />,
	play: async ({ canvasElement }) => {
		await openBlockMenu(canvasElement);
		await userEvent.click(await body().findByRole("menuitem", { name: /^정렬/ }, LONG));
		await body().findByRole("menuitemradio", { name: "가운데" }, LONG);
	},
};
