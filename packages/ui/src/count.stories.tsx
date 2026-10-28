import type { Meta, StoryObj } from "@storybook/react-vite";
import { Count } from "./count";
import { Stack } from "./stack";

/** A number in mono next to a name. No pill; warning for something to look at, danger for something that failed. */
const meta = { title: "Controls/Status/Count", component: Count, args: { children: "148" } } satisfies Meta<
	typeof Count
>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Tones: Story = {
	render: () => (
		<Stack direction="row" gap={24} align="center">
			<span>
				게시글 <Count>148</Count>
			</span>
			<span>
				도구 <Count tone="warning">1</Count>
			</span>
			<span>
				실패 <Count tone="danger">3</Count>
			</span>
			<Count>올리는 중 · 64%</Count>
		</Stack>
	),
};
