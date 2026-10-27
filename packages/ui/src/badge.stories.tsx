import type { Meta, StoryObj } from "@storybook/react-vite";
import { Check } from "lucide-react";
import { Badge } from "./badge";
import { Stack } from "./stack";

const meta = {
	title: "Status/Badge",
	component: Badge,
	args: { children: "발행됨", variant: "default" },
} satisfies Meta<typeof Badge>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const VARIANTS = ["default", "secondary", "danger", "success", "warning", "outline", "dashed"] as const;

export const AllVariants: Story = {
	render: () => (
		<Stack direction="row" gap={8} wrap align="center">
			{VARIANTS.map((variant) => (
				<Badge key={variant} variant={variant}>
					{variant}
				</Badge>
			))}
		</Stack>
	),
};

export const WithIcon: Story = {
	render: () => (
		<Stack direction="row" gap={8} align="center">
			<Badge variant="success">
				<Check data-icon="inline-start" aria-hidden />
				발행됨
			</Badge>
			<Badge variant="outline">
				초안
				<Check data-icon="inline-end" aria-hidden />
			</Badge>
		</Stack>
	),
};
