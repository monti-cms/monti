import type { Meta, StoryObj } from "@storybook/react-vite";
import { RadioGroup, RadioItem } from "./radio-group";

/** One choice out of a few: a ring that fills when picked, the label, and an optional note in mono. */
const meta = {
	title: "Controls/Choice/Radio",
	component: RadioGroup,
	args: { defaultValue: "move" },
	render: (args) => (
		<RadioGroup {...args}>
			<RadioItem value="move" label="값 옮기기" hint="글 148편" />
			<RadioItem value="blank" label="새 칸으로 시작" />
		</RadioGroup>
	),
} satisfies Meta<typeof RadioGroup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Picked, not picked, and a disabled option. */
export const ItemStates: Story = {
	render: () => (
		<RadioGroup defaultValue="published">
			<RadioItem value="published" label="발행된 글만" hint="글 120편" />
			<RadioItem value="draft" label="초안만" hint="글 28편" />
			<RadioItem value="private" label="비공개 글" disabled />
		</RadioGroup>
	),
};

export const GroupDisabled: Story = {
	render: () => (
		<RadioGroup disabled defaultValue="all">
			<RadioItem value="all" label="모든 글" />
			<RadioItem value="draft" label="초안만" />
		</RadioGroup>
	),
};
