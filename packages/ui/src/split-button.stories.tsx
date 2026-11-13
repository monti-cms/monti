import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { DropdownMenuItem } from "./dropdown-menu";
import { Add, CalendarSettings } from "./icons";
import { SplitButton } from "./split-button";

const meta = {
	title: "Controls/Button/SplitButton",
	component: SplitButton,
	args: {
		children: "발행",
		menuLabel: "발행 방식",
		menu: (
			<DropdownMenuItem>
				<CalendarSettings aria-hidden />
				오늘 날짜로 다시 발행
			</DropdownMenuItem>
		),
	},
} satisfies Meta<typeof SplitButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Disabled: Story = { args: { disabled: true } };

/** A leading icon, as the list's "New post" has its +: 16px, pulled 2px into the left padding as on a `Button`. */
export const WithIcon: Story = {
	args: {
		children: (
			<>
				<Add aria-hidden />새 게시글
			</>
		),
		menuLabel: "다른 방법으로 추가",
	},
	play: async ({ canvasElement }) => {
		const icon = within(canvasElement).getByRole("button", { name: "새 게시글" }).querySelector("svg");
		await expect(icon?.getBoundingClientRect().width).toBe(16);
	},
};

/** Working with a leading icon: the spinner stands in the icon's place. */
export const WithIconLoading: Story = {
	args: {
		loading: true,
		children: (
			<>
				<Add aria-hidden />
				만드는 중
			</>
		),
		menuLabel: "다른 방법으로 추가",
	},
};

/** Working on the main action: a spinner comes first in the main half, the label says what is happening, the pill keeps its fill, and neither half can be pressed. */
export const Loading: Story = { args: { loading: true, children: "발행 중" } };

/** The menu hangs under the whole pill, its right edge on the pill's, as it does in the editor header. */
export const MenuOpen: Story = {
	decorators: [
		(Story) => (
			<div className="flex min-h-40 justify-start pt-monti-12 pl-64">
				<Story />
			</div>
		),
	],
	play: async ({ canvasElement }) => {
		await userEvent.click(within(canvasElement).getByRole("button", { name: "발행 방식" }));
		const item = await within(document.body).findByRole("menuitem", { name: "오늘 날짜로 다시 발행" });
		// The menu fades in: it is visible once its opening has run.
		await waitFor(() => expect(item).toBeVisible());
	},
};

/** Keyboard focus on the main half: one ring round the whole pill, and the half that has the focus a shade lighter. */
export const FocusMain: Story = {
	play: async () => {
		await userEvent.tab();
	},
};

/** Keyboard focus on the caret half: the same ring round the whole pill. */
export const FocusMenu: Story = {
	play: async ({ canvasElement }) => {
		await userEvent.tab();
		await userEvent.tab();
		await expect(within(canvasElement).getByRole("button", { name: "발행 방식" })).toHaveFocus();
	},
};
