import type { Doc } from "@monti-cms/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor } from "storybook/test";
import type { StorySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import { admin, caretIn, editor, select, site, wait } from "./templates.stories";

type Loaded = { site: StorySite };

/** What only a play checks: that an action works. Kept out of the screens a person reviews (2026-11-06 owner). */
const meta = {
	tags: ["test"],
	title: "Tests/Tools/Templates",
	render: (_args, { loaded }) => <MontiAdmin transport={(loaded as Loaded).site.transport} siteName="example.dev" />,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The "/" menu under a "/" typed on an empty line (flow 1, step 02). */
export const SlashMenu: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { text, body } = await editor(canvasElement);
		// The caret at the end of a line, a new line, and "/" typed at its start.
		await select(text, "한 줄 요약과 다음에 읽을 글.");
		document.getSelection()?.collapseToEnd();
		document.dispatchEvent(new Event("selectionchange"));
		await userEvent.keyboard("{Enter}/");
		await body.findByRole("listbox", { name: "블록" }, wait);
	},
};

/** "서식 지우기": on the format card only while the picked words have a format; one press takes them all off (a link stays). */
export const ClearFormatting: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { text, body } = await editor(canvasElement);
		await select(text, "무엇을 다루는지");
		await body.findByRole("toolbar", { name: "서식" }, wait);
		await expect(body.queryByRole("button", { name: "서식 지우기" })).toBeNull();
		await userEvent.click(body.getByRole("button", { name: "굵게" }));
		await userEvent.click(body.getByRole("button", { name: "기울임" }));
		// A wider pick that holds the formatted words still offers it.
		await select(text, "이 글에서 무엇을 다루는지 한두");
		await userEvent.click(await body.findByRole("button", { name: "서식 지우기" }, wait));
		await waitFor(() => expect(text.querySelector("strong, em")).toBeNull(), wait);
		await waitFor(() => expect(body.queryByRole("button", { name: "서식 지우기" })).toBeNull(), wait);
	},
};

/** ⌘\ with the caret inside formatted words, nothing picked: that run of formats comes off. */
export const ClearAtCaret: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { text, body } = await editor(canvasElement);
		await select(text, "무엇을 다루는지");
		await userEvent.click(await body.findByRole("button", { name: "굵게" }, wait));
		await caretIn(text, "무엇을 다루는지");
		await userEvent.keyboard("{Meta>}\\{/Meta}");
		await waitFor(() => expect(text.querySelector("strong")).toBeNull(), wait);
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
		await page.findByText("다른 곳에서 먼저 저장했습니다", {}, wait);
		await waitFor(() => expect(page.getByText("저장 안 됨")).toBeVisible());
	},
};
