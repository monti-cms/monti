import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, fireEvent, userEvent, waitFor, within } from "storybook/test";
import type { StorySite } from "../../../.storybook/pglite-site";
import { MontiAdmin } from "../../app";
import {
	changeFields,
	DeleteReview,
	fieldOrder,
	fill,
	openChanges,
	pause,
	settings,
	site,
	twoTabs,
	wait,
} from "./collections.stories";

type Loaded = { site: StorySite };

/** What only a play checks: that an action works. Kept out of the screens a person reviews (2026-11-06 owner). */
const meta = {
	tags: ["test"],
	title: "Tests/Settings/Collections",
	render: (_args, { loaded }) => <MontiAdmin transport={(loaded as Loaded).site.transport} siteName="example.dev" />,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

/** The changes list: a row's "되돌리기" puts that change back and keeps the list open; pressing a row opens its field. */
export const ChangesListRows: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page, body } = await changeFields(canvasElement);
		await openChanges(page, body);
		const menu = within(await body.findByRole("menu"));
		const subtitle = menu.getByRole("menuitem", { name: /부제/ });
		await userEvent.click(within(subtitle).getByRole("button", { name: "되돌리기" }));
		await waitFor(() => expect(menu.queryByRole("menuitem", { name: /부제/ })).toBeNull(), wait);
		await expect(body.getByRole("menu")).toBeInTheDocument();
		await userEvent.click(menu.getByRole("menuitem", { name: /요약/ }));
		await body.findByRole("dialog", { name: /요약/ }, wait);
	},
};

/** Flow 4, step 18: the memos are deleted: gone from the list, and the toast says it is applied (the removal's undo toast is gone). */
export const Deleted: Story = {
	loaders: site(),
	play: async (context) => {
		await DeleteReview.play?.(context);
		const body = within(context.canvasElement.ownerDocument.body);
		await userEvent.click(body.getByRole("button", { name: "지우고 적용" }));
		await body.findByText("적용했습니다", {}, wait);
		// The removal's undo toast goes with the save: there is nothing left for it to undo.
		await waitFor(() => expect(body.queryByText("메모 컬렉션을 지웠습니다")).toBeNull(), wait);
	},
};

/** A tab renamed through its right-click menu: "이름 바꾸기" opens the name in place, Enter keeps it. */
export const TabRenamedFromMenu: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page, body } = await settings(canvasElement);
		await userEvent.pointer({ keys: "[MouseRight]", target: page.getByRole("tab", { name: /^기본/ }) });
		await userEvent.click(await body.findByRole("menuitem", { name: "이름 바꾸기" }));
		const name = await page.findByRole("textbox", { name: "탭 이름" }, wait);
		await waitFor(() => expect(name).toHaveFocus(), wait);
		fill(name, "글 정보");
		fireEvent.keyDown(name, { key: "Enter" });
		await page.findByRole("tab", { name: /^글 정보/ }, wait);
	},
};

/** A tab deleted through its right-click menu: its fields join the end of the first tab, and the tab row keeps one tab (no "지우기" then). */
export const TabDeleted: Story = {
	loaders: site({ more: twoTabs }),
	play: async ({ canvasElement }) => {
		const { page, body } = await settings(canvasElement);
		await userEvent.pointer({ keys: "[MouseRight]", target: await page.findByRole("tab", { name: /^SEO/ }, wait) });
		await userEvent.click(await body.findByRole("menuitem", { name: "지우기" }));
		await waitFor(() => expect(page.queryByRole("tab", { name: /^SEO/ })).toBeNull(), wait);
		await waitFor(
			() => expect(fieldOrder(page)).toEqual(["title", "slug", "summary", "category", "subtitle", "cover"]),
			wait,
		);
	},
};

/** Fields reordered with the keyboard: Space lifts summary by its grip, ↓ moves it past subtitle, Space drops it there. */
export const KeyboardReorder: Story = {
	loaders: site(),
	play: async ({ canvasElement }) => {
		const { page } = await settings(canvasElement);
		await expect(fieldOrder(page)).toEqual(["title", "slug", "summary", "subtitle", "cover", "category"]);
		page.getByRole("button", { name: "summary 옮기기" }).focus();
		await userEvent.keyboard("[Space]");
		await pause(100);
		await userEvent.keyboard("[ArrowDown]");
		await pause(300);
		await userEvent.keyboard("[Space]");
		await waitFor(
			() => expect(fieldOrder(page)).toEqual(["title", "slug", "subtitle", "summary", "cover", "category"]),
			wait,
		);
	},
};
