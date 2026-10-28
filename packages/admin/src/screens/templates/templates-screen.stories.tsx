import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { answer, type FakeApi, PageFrame } from "../../stories/screen-frame";
import { TemplatesScreen } from "./templates-screen";

/** Tools › Templates (canvas `Templates`): a row per template, "Add template" in the header. Dates are read against the board's day (10. 26). */
const meta = {
	title: "Screens/Templates/Templates list",
	parameters: { layout: "fullscreen", bleed: true },
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const NOW = new Date("2026-10-26T03:00:00.000Z");
const heading = (id: string, text: string) => ({
	type: "heading",
	id,
	attrs: { level: 2 },
	content: [{ type: "text", text }],
});
const template = (id: string, name: string, updatedAt: string, sections: string[]) => ({
	id,
	name,
	doc: { type: "doc", version: 3, content: sections.map((text, index) => heading(`${id}${index}abcdef`, text)) },
	version: 1,
	createdAt: "2026-08-01T00:00:00.000Z",
	updatedAt,
});
const templates = [
	template("a", "기본 글", "2026-10-20T03:00:00.000Z", ["서론", "본론", "결론"]),
	template("b", "책 리뷰", "2026-09-02T03:00:00.000Z", ["한 줄 평", "줄거리", "인용", "생각"]),
	template("c", "튜토리얼", "2026-08-14T03:00:00.000Z", ["준비물", "단계", "코드", "마무리"]),
];

const api =
	(items: unknown[]): FakeApi =>
	(path, method) =>
		path === "/api/monti/v1/templates" && method === "GET" ? { items } : undefined;

const screen = (fake: FakeApi) => () => (
	<PageFrame api={fake} pathname="/admin/tools/templates">
		<TemplatesScreen now={NOW} />
	</PageFrame>
);

export const Loaded: Story = { tags: ["visual"], render: screen(api(templates)) };
export const Empty: Story = { render: screen(api([])) };
export const Loading: Story = { render: screen(() => "pending") };
export const LoadFailed: Story = { render: screen(() => answer(500)) };

/** The `⋯` of a row: duplicate and delete. */
export const RowMenu: Story = {
	tags: ["visual"],
	render: screen(api(templates)),
	play: async ({ canvasElement }) => {
		const [more] = await within(canvasElement).findAllByRole("button", { name: "더보기: 복제, 지우기" });
		if (more) await userEvent.click(more);
		await within(document.body).findByRole("menuitem", { name: "복제" });
	},
};

/** Deleting asks first. */
export const DeleteConfirm: Story = {
	render: screen(api(templates)),
	play: async ({ canvasElement }) => {
		const [more] = await within(canvasElement).findAllByRole("button", { name: "더보기: 복제, 지우기" });
		if (more) await userEvent.click(more);
		await userEvent.click(await within(document.body).findByRole("menuitem", { name: "지우기" }));
		await waitFor(() => expect(within(document.body).getByRole("alertdialog")).toBeInTheDocument());
	},
};
