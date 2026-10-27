import type { Meta, StoryObj } from "@storybook/react-vite";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Layout/Stack",
	component: Stack,
	args: { gap: "normal", direction: "column" },
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
		<div className={tall ? "rounded-monti-md bg-monti-muted p-4" : "rounded-monti-md bg-monti-muted p-2"}>
			<Text variant="caption">{children}</Text>
		</div>
	);
}

export const Playground: Story = {};

const GAPS = ["none", "tight", "condensed", "normal", "comfortable", "spacious", "section"] as const;
const ALIGNS = ["start", "center", "end", "baseline", "stretch"] as const;
const JUSTIFIES = ["start", "center", "end", "between"] as const;

export const AllGaps: Story = {
	render: () => (
		<Stack gap="spacious">
			{GAPS.map((gap) => (
				<Stack key={gap} gap="tight">
					<Text variant="label" tone="muted">
						gap {gap}
					</Text>
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
		<Stack direction="row" gap="section" align="start">
			{GAPS.map((gap) => (
				<Stack key={gap} gap="tight">
					<Text variant="label" tone="muted">
						{gap}
					</Text>
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
		<Stack gap="spacious">
			{ALIGNS.map((align) => (
				<Stack key={align} gap="tight">
					<Text variant="label" tone="muted">
						align {align}
					</Text>
					<Stack direction="row" align={align} className="rounded-monti-md bg-monti-tool p-2">
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
		<Stack gap="spacious">
			{JUSTIFIES.map((justify) => (
				<Stack key={justify} gap="tight">
					<Text variant="label" tone="muted">
						justify {justify}
					</Text>
					<Stack direction="row" justify={justify} className="rounded-monti-md bg-monti-tool p-2">
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
		<Stack direction="row" wrap gap="condensed" className="max-w-xs">
			{["일상", "여행", "맛집", "독서", "개발", "사진", "음악", "영화"].map((tag) => (
				<Box key={tag}>{tag}</Box>
			))}
		</Stack>
	),
};

export const Elements: Story = {
	render: () => (
		<Stack as="ul" gap="tight">
			{["첫째", "둘째", "셋째"].map((item) => (
				<Stack as="li" key={item} direction="row" gap="tight">
					<Text>{item}</Text>
				</Stack>
			))}
		</Stack>
	),
};
