import type { Meta, StoryObj } from "@storybook/react-vite";
import { Separator } from "./separator";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Layout/Separator",
	component: Separator,
} satisfies Meta<typeof Separator>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<Stack className="max-w-sm">
			<Text>위</Text>
			<Separator {...args} />
			<Text>아래</Text>
		</Stack>
	),
};

export const Orientations: Story = {
	render: () => (
		<Stack gap={24}>
			<Stack className="max-w-sm">
				<Text>horizontal</Text>
				<Separator orientation="horizontal" />
				<Text>다음 항목</Text>
			</Stack>
			<Stack direction="row" gap={16} className="h-6">
				<Text>글</Text>
				<Separator orientation="vertical" />
				<Text>페이지</Text>
				<Separator orientation="vertical" />
				<Text>설정</Text>
			</Stack>
		</Stack>
	),
};
