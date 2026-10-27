import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { ButtonGroup } from "./button-group";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Controls/ButtonGroup",
	component: ButtonGroup,
	render: (args) => (
		<ButtonGroup {...args}>
			<Button>목록</Button>
			<Button>표</Button>
			<Button>카드</Button>
		</ButtonGroup>
	),
} satisfies Meta<typeof ButtonGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const VARIANTS = ["default", "outline", "secondary", "ghost"] as const;
const SIZES = ["xs", "sm", "default", "lg"] as const;

/** Give every button in the group the same variant and size. A button with a menu is a SplitButton, not a group. */
export const Variants: Story = {
	render: () => (
		<Stack gap={12}>
			{VARIANTS.map((variant) => (
				<Stack key={variant} gap={4} align="start">
					<Text variant="label" tone="muted">
						variant {variant}
					</Text>
					<ButtonGroup>
						<Button variant={variant}>목록</Button>
						<Button variant={variant}>표</Button>
						<Button variant={variant}>카드</Button>
					</ButtonGroup>
				</Stack>
			))}
		</Stack>
	),
};

export const Sizes: Story = {
	render: () => (
		<Stack gap={12}>
			{SIZES.map((size) => (
				<Stack key={size} gap={4} align="start">
					<Text variant="label" tone="muted">
						size {size}
					</Text>
					<ButtonGroup>
						<Button variant="outline" size={size}>
							발행
						</Button>
						<Button variant="outline" size={size}>
							예약
						</Button>
						<Button variant="outline" size={size}>
							오늘 날짜로 다시 발행
						</Button>
					</ButtonGroup>
				</Stack>
			))}
		</Stack>
	),
};

export const Disabled: Story = {
	render: () => (
		<ButtonGroup>
			<Button variant="outline" disabled>
				목록
			</Button>
			<Button variant="outline" disabled>
				표
			</Button>
		</ButtonGroup>
	),
};
