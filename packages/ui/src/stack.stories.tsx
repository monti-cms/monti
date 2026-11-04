import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Primitives/Stack",
	component: Stack,
	args: { gap: 12, direction: "column" },
	render: (args) => (
		<Stack {...args}>
			<Box>첫째</Box>
			<Box>둘째</Box>
			<Box>셋째</Box>
		</Stack>
	),
} satisfies Meta<typeof Stack>;
export default meta;
type Story = StoryObj<typeof meta>;

function Box({ children, tall }: { children: string; tall?: boolean }) {
	return (
		<div className={tall ? "h-16 rounded-monti-md bg-monti-selected p-2" : "rounded-monti-md bg-monti-selected p-2"}>
			<Text variant="caption">{children}</Text>
		</div>
	);
}

export const Playground: Story = {};

export const Wrap: Story = {
	render: () => (
		<Stack direction="row" wrap gap={8} className="max-w-xs">
			{["일상", "여행", "맛집", "독서", "개발", "사진", "음악", "영화"].map((tag) => (
				<Box key={tag}>{tag}</Box>
			))}
		</Stack>
	),
};
