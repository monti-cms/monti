import type { Meta, StoryObj } from "@storybook/react-vite";
import { Progress } from "./progress";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Feedback/Progress",
	component: Progress,
	args: { value: 40, label: "업로드 진행률" },
	decorators: [
		(Story) => (
			<div className="max-w-sm">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Progress>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Values: Story = {
	render: () => (
		<Stack gap={12}>
			{[0, 25, 50, 75, 100].map((value) => (
				<Stack key={value} gap={4}>
					<Text variant="label" tone="muted">
						value {value}
					</Text>
					<Progress value={value} label={`업로드 진행률 ${value}%`} />
				</Stack>
			))}
		</Stack>
	),
};

/** `value` null: the amount is unknown, so the bar moves on its own. */
export const Indeterminate: Story = {
	args: { value: null },
};
