import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import { answer, type FakeApi, PageFrame } from "../../stories/screen-frame";
import { TemplateEditorScreen } from "./template-editor-screen";

/** The page of one template (canvas `TemplateEditor`): back link, the name over the body, and the character count. */
const meta = {
	title: "Screens/Templates/Template editor",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const block = (type: string, id: string, text: string, attrs?: Record<string, unknown>) => ({
	type,
	id,
	...(attrs ? { attrs } : {}),
	content: [{ type: "text", text }],
});
const template = {
	id: "a",
	name: "기본 글",
	doc: {
		type: "doc",
		version: 3,
		content: [
			block("heading", "aaaa1111", "서론", { level: 2 }),
			block("paragraph", "aaaa2222", "이 글에서 무엇을 다루는지 한두 문장으로."),
			block("heading", "aaaa3333", "본론", { level: 2 }),
			block("paragraph", "aaaa4444", "첫 번째 요점"),
			block("heading", "aaaa5555", "결론", { level: 2 }),
			block("paragraph", "aaaa6666", "한 줄 요약과 다음에 읽을 글."),
		],
	},
	version: 1,
	createdAt: "2026-08-01T00:00:00.000Z",
	updatedAt: "2026-10-20T03:00:00.000Z",
};

const api =
	(onWrite: FakeApi = () => ({ ok: true })): FakeApi =>
	(path, method) => {
		if (path === "/api/monti/v1/templates/a" && method === "GET") return template;
		if (path.startsWith("/api/monti/v1/templates")) return onWrite(path, method);
		return undefined;
	};

/** The page of the template `a`, or a new template when `id` is `null` (a default would turn "no id" into `a`). */
const screen =
	(fake: FakeApi, id: string | null = "a") =>
	() => (
		<PageFrame api={fake} pathname={id ? `/admin/templates/${id}/edit` : "/admin/templates/new"}>
			<TemplateEditorScreen id={id ?? undefined} />
		</PageFrame>
	);

const nameField = (canvasElement: HTMLElement) => within(canvasElement).findByRole("textbox", { name: "템플릿 이름" });

export const Saved: Story = {
	tags: ["visual"],
	render: screen(api()),
	play: async ({ canvasElement }) => {
		await waitFor(async () => expect(await nameField(canvasElement)).toHaveValue("기본 글"));
	},
};

/** The name changed: "저장 안 됨" and the save button show. */
export const Unsaved: Story = {
	tags: ["visual"],
	render: screen(api()),
	play: async ({ canvasElement }) => {
		const name = await nameField(canvasElement);
		await waitFor(() => expect(name).toHaveValue("기본 글"));
		await userEvent.type(name, " 2");
		await within(canvasElement).findByText("저장 안 됨");
	},
};

export const New: Story = { tags: ["visual"], render: screen(api(), null) };
export const Loading: Story = { render: screen(() => "pending") };
export const LoadFailed: Story = {
	render: screen(() => answer(500, { error: { message: "템플릿을 불러오지 못했어요." } })),
};
export const SaveRefused: Story = {
	render: screen(api(() => answer(409, { error: { code: "conflict", message: "다른 곳에서 먼저 바뀌었어요." } }))),
	play: async ({ canvasElement }) => {
		const name = await nameField(canvasElement);
		await waitFor(() => expect(name).toHaveValue("기본 글"));
		await userEvent.type(name, " 2");
		fireEvent.keyDown(window, { key: "s", metaKey: true });
		await within(canvasElement).findByText("다른 곳에서 먼저 저장했어요");
	},
};
