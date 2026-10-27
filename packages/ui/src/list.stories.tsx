import type { Meta, StoryObj } from "@storybook/react-vite";
import { List, ListItem } from "./list";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Patterns/List/List",
	component: List,
	args: { marker: "bullet", ordered: false },
	render: (args) => (
		<List {...args}>
			<ListItem>글 세 편이 발행돼요</ListItem>
			<ListItem>이미지 두 장이 옮겨져요</ListItem>
			<ListItem>기존 주소는 그대로 유지돼요</ListItem>
		</List>
	),
} satisfies Meta<typeof List>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

const ITEMS = ["글 세 편이 발행돼요", "이미지 두 장이 옮겨져요", "기존 주소는 그대로 유지돼요"];

export const Markers: Story = {
	render: () => (
		<Stack gap={24}>
			{(["bullet", "none"] as const).map((marker) => (
				<Stack key={marker} gap={4}>
					<Text variant="label" tone="muted">
						marker {marker}
					</Text>
					<List marker={marker}>
						{ITEMS.map((item) => (
							<ListItem key={item}>{item}</ListItem>
						))}
					</List>
				</Stack>
			))}
		</Stack>
	),
};

export const Ordered: Story = {
	render: () => (
		<Stack gap={24}>
			{(["bullet", "none"] as const).map((marker) => (
				<Stack key={marker} gap={4}>
					<Text variant="label" tone="muted">
						ordered, marker {marker}
					</Text>
					<List ordered marker={marker}>
						{ITEMS.map((item) => (
							<ListItem key={item}>{item}</ListItem>
						))}
					</List>
				</Stack>
			))}
		</Stack>
	),
};
