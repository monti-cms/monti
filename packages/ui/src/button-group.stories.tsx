import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChevronDown } from "lucide-react";
import { Button } from "./button";
import { ButtonGroup } from "./button-group";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Controls/ButtonGroup",
	component: ButtonGroup,
	render: (args) => (
		<ButtonGroup {...args}>
			<Button>발행</Button>
			<Button size="icon" aria-label="발행 방식">
				<ChevronDown aria-hidden />
			</Button>
		</ButtonGroup>
	),
} satisfies Meta<typeof ButtonGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const VARIANTS = ["default", "outline", "secondary", "ghost"] as const;
const SIZES = ["xs", "sm", "default", "lg"] as const;

/** Give every button in the group the same variant and size. */
export const Variants: Story = {
	render: () => (
		<Stack gap="normal">
			{VARIANTS.map((variant) => (
				<Stack key={variant} gap="tight" align="start">
					<Text variant="label" tone="muted">
						variant {variant}
					</Text>
					<ButtonGroup>
						<Button variant={variant}>발행</Button>
						<Button variant={variant} size="icon" aria-label="발행 방식">
							<ChevronDown aria-hidden />
						</Button>
					</ButtonGroup>
				</Stack>
			))}
		</Stack>
	),
};

export const Sizes: Story = {
	render: () => (
		<Stack gap="normal">
			{SIZES.map((size) => (
				<Stack key={size} gap="tight" align="start">
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
				발행
			</Button>
			<Button variant="outline" size="icon" aria-label="발행 방식" disabled>
				<ChevronDown aria-hidden />
			</Button>
		</ButtonGroup>
	),
};
