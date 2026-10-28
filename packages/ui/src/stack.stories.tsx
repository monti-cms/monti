import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "./stack";
import { StoryCaption } from "./story-caption";
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

const GAPS = [0, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48] as const;
const ALIGNS = ["start", "center", "end", "baseline", "stretch"] as const;
const JUSTIFIES = ["start", "center", "end", "between"] as const;

export const AllGaps: Story = {
	render: () => (
		<Stack gap={24}>
			{GAPS.map((gap) => (
				<Stack key={gap} gap={4}>
					<StoryCaption>gap {gap}</StoryCaption>
					<Stack direction="row" gap={gap}>
						<Box>첫째</Box>
						<Box>둘째</Box>
						<Box>셋째</Box>
					</Stack>
				</Stack>
			))}
		</Stack>
	),
};

export const ColumnGaps: Story = {
	render: () => (
		<Stack direction="row" gap={32} align="start" wrap>
			{GAPS.map((gap) => (
				<Stack key={gap} gap={4}>
					<StoryCaption>{gap}</StoryCaption>
					<Stack gap={gap}>
						<Box>첫째</Box>
						<Box>둘째</Box>
					</Stack>
				</Stack>
			))}
		</Stack>
	),
};

export const Align: Story = {
	render: () => (
		<Stack gap={24}>
			{ALIGNS.map((align) => (
				<Stack key={align} gap={4}>
					<StoryCaption>align {align}</StoryCaption>
					<Stack direction="row" align={align} className="rounded-monti-md border border-monti-default p-2">
						<Box>짧음</Box>
						<Box tall>높음</Box>
						<Box>짧음</Box>
					</Stack>
				</Stack>
			))}
		</Stack>
	),
};

export const Justify: Story = {
	render: () => (
		<Stack gap={24}>
			{JUSTIFIES.map((justify) => (
				<Stack key={justify} gap={4}>
					<StoryCaption>justify {justify}</StoryCaption>
					<Stack direction="row" justify={justify} className="rounded-monti-md border border-monti-default p-2">
						<Box>첫째</Box>
						<Box>둘째</Box>
					</Stack>
				</Stack>
			))}
		</Stack>
	),
};

export const Wrap: Story = {
	render: () => (
		<Stack direction="row" wrap gap={8} className="max-w-xs">
			{["일상", "여행", "맛집", "독서", "개발", "사진", "음악", "영화"].map((tag) => (
				<Box key={tag}>{tag}</Box>
			))}
		</Stack>
	),
};

export const Elements: Story = {
	render: () => (
		<Stack as="ul" gap={4}>
			{["첫째", "둘째", "셋째"].map((item) => (
				<Stack as="li" key={item} direction="row" gap={4}>
					<Text>{item}</Text>
				</Stack>
			))}
		</Stack>
	),
};
