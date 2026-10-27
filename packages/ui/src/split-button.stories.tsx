import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarSync } from "lucide-react";
import { expect, userEvent, within } from "storybook/test";
import { DropdownMenuItem } from "./dropdown-menu";
import { SplitButton } from "./split-button";

const meta = {
	title: "Button/SplitButton",
	component: SplitButton,
	args: {
		children: "발행",
		menuLabel: "발행 방식",
		menu: (
			<DropdownMenuItem>
				<CalendarSync aria-hidden />
				오늘 날짜로 다시 발행
			</DropdownMenuItem>
		),
	},
} satisfies Meta<typeof SplitButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Disabled: Story = { args: { disabled: true } };

/** Working on the main action: a spinner on the main half, and neither half can be pressed. */
export const Loading: Story = { args: { loading: true, children: "발행 중" } };

export const MenuOpen: Story = {
	play: async ({ canvasElement }) => {
		await userEvent.click(within(canvasElement).getByRole("button", { name: "발행 방식" }));
		await expect(await within(document.body).findByRole("menuitem", { name: "오늘 날짜로 다시 발행" })).toBeVisible();
	},
};
