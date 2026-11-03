import type { Meta, StoryObj } from "@storybook/react-vite";
import { Progress } from "./progress";
import { Stack } from "./stack";
import { StoryCaption } from "./story-caption";

const meta = {
	title: "Controls/Status/Progress",
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
					<StoryCaption>value {value}</StoryCaption>
					<Progress value={value} label={`업로드 진행률 ${value}%`} />
				</Stack>
			))}
		</Stack>
	),
};
