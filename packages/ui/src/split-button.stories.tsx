import type { Meta, StoryObj } from "@storybook/react-vite";
import { CalendarSync } from "lucide-react";
import { expect, userEvent, within } from "storybook/test";
import { DropdownMenuItem } from "./dropdown-menu";
import { SplitButton } from "./split-button";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Controls/SplitButton",
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

const SIZES = ["xs", "sm", "default", "lg"] as const;
const VARIANTS = ["default", "secondary", "outline"] as const;

/** Every variant at every size: both halves share the height, the look and the outer radius. */
export const Sizes: Story = {
	render: (args) => (
		<Stack gap={12}>
			{VARIANTS.map((variant) => (
				<Stack key={variant} gap={4} align="start">
					<Text variant="label" tone="muted">
						variant {variant}
					</Text>
					<Stack direction="row" gap={12} align="center">
						{SIZES.map((size) => (
							<SplitButton key={size} {...args} variant={variant} size={size}>
								{size}
							</SplitButton>
						))}
					</Stack>
				</Stack>
			))}
		</Stack>
	),
};

export const Disabled: Story = { args: { disabled: true } };

/** Working on the main action: a spinner on the main half, and neither half can be pressed. */
export const Loading: Story = { args: { loading: true, children: "발행 중" } };

export const MenuOpen: Story = {
	play: async ({ canvasElement }) => {
		await userEvent.click(within(canvasElement).getByRole("button", { name: "발행 방식" }));
		await expect(await within(document.body).findByRole("menuitem", { name: "오늘 날짜로 다시 발행" })).toBeVisible();
	},
};
