import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box } from "./box";
import { Grid } from "./grid";
import { Text } from "./text";

const meta = {
	title: "Primitives/Grid",
	component: Grid,
	args: { columns: 3, gap: 12 },
	render: (args) => (
		<Grid {...args}>
			{CELLS.map((cell) => (
				<Cell key={cell}>{cell}</Cell>
			))}
		</Grid>
	),
} satisfies Meta<typeof Grid>;
export default meta;
type Story = StoryObj<typeof meta>;

const CELLS = ["첫째", "둘째", "셋째", "넷째", "다섯째", "여섯째"];

function Cell({ children, tall }: { children: string; tall?: boolean }) {
	return (
		<Box background="selected" radius="md" padding={8} className={tall ? "h-16" : undefined}>
			<Text variant="caption">{children}</Text>
		</Box>
	);
}

export const Playground: Story = {};

/** `span="all"` takes every column: a wide field in a two-column form. */
export const SpanAll: Story = {
	render: () => (
		<Grid columns={2}>
			<Cell>이름</Cell>
			<Cell>주소</Cell>
			<Box span="all" background="selected" radius="md" padding={8}>
				<Text variant="caption">span all: 모든 칸을 차지해요</Text>
			</Box>
			<Cell>메모</Cell>
			<Cell>태그</Cell>
		</Grid>
	),
};
