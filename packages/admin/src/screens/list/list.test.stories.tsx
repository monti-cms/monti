import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import type { StorySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import type { ScreenChannel } from "../../operations/admin-context";
import { body, columnWidth, dragHandle, openColumn, rowsShown, run, site, wait } from "./list.stories";

type Loaded = { site: StorySite; screen: ScreenChannel };

/** What only a play checks: that an action works. Kept out of the screens a person reviews (2026-11-06 owner). */
const meta = {
	tags: ["test"],
	title: "Tests/List",
	render: (_args, { loaded }) => {
		const { site: made, screen } = loaded as Loaded;
		return <MontiAdmin transport={made.transport} siteName="example.dev" screen={screen} />;
	},
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/**
 * The same edge dragged 80px left and let go: the category's width is saved for posts. After going to the memos and back (the list read again, as after
 * a reload) the category keeps it, and no column moved (06).
 */
export const ColumnResized: Story = {
	loaders: site(),
	play: async ({ canvasElement, loaded }) => {
		const { site: made } = loaded as Loaded;
		const page = within(canvasElement);
		await rowsShown(canvasElement);
		const order = () =>
			[...canvasElement.querySelectorAll<HTMLElement>("th[data-column]")].map((th) => th.dataset.column);
		const before = order();
		await dragHandle(canvasElement, "제목 열 너비 조절", -80);
		await waitFor(async () => {
			const kept = await run<{ columns: { id: string; width?: number }[] }>(made.monti, "list.columns", {
				collection: "post",
			});
			expect(kept.columns.find((column) => column.id === "category")?.width).toBe(164);
		}, wait);
		await userEvent.click(page.getByRole("button", { name: "메모" }));
		await waitFor(() => expect(canvasElement.querySelector("th[data-column=category]")).toBeNull(), wait);
		await userEvent.click(page.getByRole("button", { name: /^게시글/ }));
		await rowsShown(canvasElement);
		await waitFor(() => expect(columnWidth(canvasElement, "category")).toBe(164), wait);
		expect(order()).toEqual(before);
	},
};

/** Opened again on a range picked before: the range calendar shows it, the name has its dot (flow 7, step 05c). */
export const DateRange: Story = {
	loaders: site(undefined, "#/c/post?updatedAt=2026-10-05..2026-10-26"),
	play: async ({ canvasElement }) => {
		await openColumn(canvasElement, "수정일");
		await userEvent.hover(body().getByRole("menuitem", { name: "기간 고르기" }));
		await waitFor(() => expect(body().getByRole("grid")).toBeTruthy(), wait);
	},
};

/** Opened again on a day picked before: "하루 고르기" is ticked and its calendar shows the day ("모든 날짜" lifts it, 2026-11-06). */
export const DateOneDay: Story = {
	loaders: site(undefined, "#/c/post?updatedAt=2026-10-26..2026-10-26"),
	play: async ({ canvasElement }) => {
		await openColumn(canvasElement, "수정일");
		await userEvent.hover(body().getByRole("menuitem", { name: "하루 고르기" }));
		await waitFor(() => expect(body().getByRole("button", { name: /10월 26일.*선택됨/ })).toBeTruthy(), wait);
	},
};

/** The session ended while the list was open: the next read comes back without one, and the banner stands at the top of the page (doc 15). */
export const SessionEnded: Story = {
	loaders: site(),
	play: async ({ canvasElement, loaded }) => {
		const { site: made } = loaded as Loaded;
		const page = within(canvasElement);
		await page.findByText("발행 후 고친 글", {}, { timeout: 15000 });
		await made.db.deleteFrom("monti_session").execute();
		await userEvent.click(page.getByRole("button", { name: "메모" }));
		await page.findByText("로그인이 풀렸어요", {}, { timeout: 15000 });
		await expect(page.getByRole("button", { name: "다시 로그인" })).toBeVisible();
	},
};
