import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box } from "./box";
import { Grid } from "./grid";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Layout/Grid",
	component: Grid,
	args: { columns: 3, gap: "normal" },
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
		<Box background="neutral" radius="md" padding={tall ? "normal" : "condensed"}>
			<Text variant="caption">{children}</Text>
		</Box>
	);
}

export const Playground: Story = {};

const COLUMNS = [1, 2, 3, 4, 6, "sidebar", "rail", "rail-wide", "tiles"] as const;
const GAPS = ["none", "tight", "condensed", "normal", "comfortable", "spacious", "wide", "section"] as const;
const ALIGNS = ["start", "center", "end", "stretch"] as const;

export const Columns: Story = {
	render: () => (
		<Stack gap="spacious">
			{COLUMNS.map((columns) => (
				<Stack key={columns} gap="tight">
					<Text variant="label" tone="muted">
						columns {columns}
					</Text>
					<Grid columns={columns}>
						{CELLS.map((cell) => (
							<Cell key={cell}>{cell}</Cell>
						))}
					</Grid>
				</Stack>
			))}
		</Stack>
	),
};

export const Gaps: Story = {
	render: () => (
		<Stack gap="spacious">
			{GAPS.map((gap) => (
				<Stack key={gap} gap="tight">
					<Text variant="label" tone="muted">
						gap {gap}
					</Text>
					<Grid columns={3} gap={gap}>
						{CELLS.map((cell) => (
							<Cell key={cell}>{cell}</Cell>
						))}
					</Grid>
				</Stack>
			))}
		</Stack>
	),
};

export const Align: Story = {
	render: () => (
		<Stack gap="spacious">
			{ALIGNS.map((align) => (
				<Stack key={align} gap="tight">
					<Text variant="label" tone="muted">
						align {align}
					</Text>
					<Grid columns={3} align={align} background="inset" padding="tight">
						<Cell>짧음</Cell>
						<Cell tall>높음</Cell>
						<Cell>짧음</Cell>
					</Grid>
				</Stack>
			))}
		</Stack>
	),
};

/** `responsive` stacks a fixed-count grid into one column on a narrow screen; `false` keeps the columns. Narrow the window to compare. */
export const Responsive: Story = {
	render: () => (
		<Stack gap="spacious">
			{[true, false].map((responsive) => (
				<Stack key={String(responsive)} gap="tight">
					<Text variant="label" tone="muted">
						responsive {String(responsive)}
					</Text>
					<Grid columns={3} responsive={responsive}>
						{CELLS.slice(0, 3).map((cell) => (
							<Cell key={cell}>{cell}</Cell>
						))}
					</Grid>
				</Stack>
			))}
		</Stack>
	),
};

/** `span="all"` takes every column: a wide field in a two-column form. */
export const SpanAll: Story = {
	render: () => (
		<Grid columns={2}>
			<Cell>이름</Cell>
			<Cell>주소</Cell>
			<Box span="all" background="accent-muted" radius="md" padding="condensed">
				<Text variant="caption">span all: 모든 칸을 차지해요</Text>
			</Box>
			<Cell>메모</Cell>
			<Cell>태그</Cell>
		</Grid>
	),
};

export const WithLayoutOptions: Story = {
	render: () => (
		<Grid columns={3} padding="normal" background="inset" border="all" radius="lg">
			{CELLS.map((cell) => (
				<Cell key={cell}>{cell}</Cell>
			))}
		</Grid>
	),
};

export const Elements: Story = {
	render: () => (
		<Grid as="ul" columns={3}>
			{CELLS.slice(0, 3).map((cell) => (
				<Box as="li" key={cell} background="neutral" radius="md" padding="condensed">
					<Text variant="caption">{cell}</Text>
				</Box>
			))}
		</Grid>
	),
};
