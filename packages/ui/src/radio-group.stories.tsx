import type { Meta, StoryObj } from "@storybook/react-vite";
import { RadioGroup, RadioItem } from "./radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./select";

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

/** A choice that needs one more answer carries it at the end of its row: the select says which field the values move to. */
export const WithControl: Story = {
	render: () => (
		<RadioGroup defaultValue="keep">
			<RadioItem value="keep" label="남겨 두기" hint="132편" />
			<RadioItem
				value="move"
				label="다른 필드로 옮기기"
				control={
					<Select items={[{ value: "summary", label: "요약" }]} defaultValue="summary">
						<SelectTrigger size="sm" aria-label="필드">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="summary">요약</SelectItem>
						</SelectContent>
					</Select>
				}
			/>
			<RadioItem value="erase" label="값 지우기" />
		</RadioGroup>
	),
};

/** A short note right after the label says what the choice is (the kind of a new collection). */
export const WithDescription: Story = {
	render: () => (
		<RadioGroup defaultValue="document">
			<RadioItem value="document" label="문서" description="게시글, 노트처럼 본문이 있어요" />
			<RadioItem value="item" label="항목" description="카테고리, 태그처럼 짧아요" />
		</RadioGroup>
	),
};
