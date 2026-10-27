import type { Meta, StoryObj } from "@storybook/react-vite";
import { DescriptionItem, DescriptionList } from "./description-list";

/** Label and value rows: a 76px label column, 8px between rows, labels quiet and values a step darker. */
const meta = {
	title: "Patterns/List/DescriptionList",
	component: DescriptionList,
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
