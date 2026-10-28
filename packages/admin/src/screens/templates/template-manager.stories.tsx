import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { answer, type FakeApi, PageFrame } from "../../stories/screen-frame";
import { TemplateManager } from "./template-manager";

const meta = {
	title: "Screens/Templates/Template manager",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const doc = {
	type: "doc",
	version: 3,
	content: [
		{ type: "heading", id: "abcd1234", attrs: { level: 2 }, content: [{ type: "text", text: "개요" }] },
		{ type: "paragraph", id: "efgh5678", content: [{ type: "text", text: "여기에 내용을 적어요." }] },
	],
};
const template = (id: string, name: string) => ({
	id,
	name,
	doc,
	version: 1,
	createdAt: "2026-09-01T00:00:00.000Z",
	updatedAt: "2026-10-01T00:00:00.000Z",
});
const templates = [template("a", "일반 게시글"), template("b", "메모"), template("c", "공지사항")];

/** The list answers; `onWrite` answers the PATCH and DELETE requests. */
const api =
	(items: unknown[], onWrite: FakeApi = () => ({ ok: true })): FakeApi =>
	(path, method) => {
		if (path === "/api/monti/v1/templates" && method === "GET") return { items };
		if (path.startsWith("/api/monti/v1/templates/")) return onWrite(path, method);
		return undefined;
	};

const screen = (fake: FakeApi) => () => (
	<PageFrame api={fake} pathname="/admin/tools/templates">
		<TemplateManager />
	</PageFrame>
);

/** Opens the first row of the list. */
const openFirst = async (canvasElement: HTMLElement) => {
	// The row, not its ⋯ button (whose name also holds the title).
	const [row] = await within(canvasElement).findAllByRole("button", { name: /^일반 게시글/ });
	if (row) await userEvent.click(row);
	await within(canvasElement).findByRole("textbox", { name: "템플릿 이름" });
};

export const Loaded: Story = { tags: ["visual"], render: screen(api(templates)) };
export const TemplateOpen: Story = {
	render: screen(api(templates)),
	play: ({ canvasElement }) => openFirst(canvasElement),
};
export const Empty: Story = { render: screen(api([])) };
export const Loading: Story = { render: screen(() => "pending") };
export const LoadFailed: Story = { render: screen(() => answer(500)) };
export const SaveFailed: Story = {
	render: screen(
		api(templates, () => answer(409, { error: { code: "conflict", message: "다른 곳에서 먼저 바뀌었어요." } })),
	),
	play: async ({ canvasElement }) => {
		await openFirst(canvasElement);
		const c = within(canvasElement);
		await userEvent.type(c.getByRole("textbox", { name: "템플릿 이름" }), " 2");
		await userEvent.click(await c.findByRole("button", { name: "저장" }));
		await waitFor(() => expect(c.getByText("다른 곳에서 먼저 바뀌었어요.")).toBeInTheDocument());
	},
};
export const DeleteConfirm: Story = {
	render: screen(api(templates)),
	play: async ({ canvasElement }) => {
		await userEvent.click(await within(canvasElement).findByRole("button", { name: "'일반 게시글' 템플릿 작업" }));
		await userEvent.click(await within(document.body).findByRole("menuitem", { name: /삭제/ }));
		await within(document.body).findByRole("alertdialog");
	},
};
