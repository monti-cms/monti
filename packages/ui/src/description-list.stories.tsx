import type { Meta, StoryObj } from "@storybook/react-vite";
import { DescriptionItem, DescriptionList } from "./description-list";
import { Stack } from "./stack";
import { Text } from "./text";

const meta = {
	title: "Layout/DescriptionList",
	component: DescriptionList,
	args: { layout: "columns" },
	render: (args) => (
		<DescriptionList {...args} className="max-w-md">
			<DescriptionItem label="이름">여름 여행 기록</DescriptionItem>
			<DescriptionItem label="상태">초안</DescriptionItem>
			<DescriptionItem label="수정일">2026-09-18</DescriptionItem>
		</DescriptionList>
	),
} satisfies Meta<typeof DescriptionList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const Layouts: Story = {
	render: () => (
		<Stack gap="spacious">
			{(["columns", "stacked"] as const).map((layout) => (
				<Stack key={layout} gap="tight">
					<Text variant="label" tone="muted">
						layout {layout}
					</Text>
					<DescriptionList layout={layout} className="max-w-md">
						<DescriptionItem label="이름">여름 여행 기록</DescriptionItem>
						<DescriptionItem label="상태">초안</DescriptionItem>
						<DescriptionItem label="수정일">2026-09-18</DescriptionItem>
					</DescriptionList>
				</Stack>
			))}
		</Stack>
	),
};

/** Long values wrap inside the value column. */
export const LongValues: Story = {
	render: () => (
		<DescriptionList className="max-w-md">
			<DescriptionItem label="설명">
				아주 긴 설명이 들어가도 값 칸 안에서 줄이 바뀌고, 이름 칸의 너비는 그대로 유지돼요.
			</DescriptionItem>
			<DescriptionItem label="주소">https://example.com/아주/긴/주소/여름-여행-기록-2026</DescriptionItem>
		</DescriptionList>
	),
};
