import { CalendarSettings } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { DropdownMenuItem } from "./dropdown-menu";
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
		await expect(await within(document.body).findByRole("menuitem", { name: "오늘 날짜로 다시 발행" })).toBeVisible();
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
