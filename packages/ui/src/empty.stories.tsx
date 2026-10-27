import type { Meta, StoryObj } from "@storybook/react-vite";
import { Empty, EmptyStep } from "./empty";

/**
 * What a list shows when it is empty: a line that says so, one quiet line, and then what can be done, in order. The numbers are only for
 * steps whose order really matters.
 */
const meta = {
	title: "Patterns/List/Empty",
	component: Empty,
	args: { title: "아직 글이 없어요.", description: "어디서부터 시작할까요?" },
	decorators: [
		(Story) => (
			<div className="max-w-xl">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof Empty>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<Empty {...args}>
			<EmptyStep number="01">첫 글 쓰기</EmptyStep>
			<EmptyStep number="02">쓰던 글 가져오기</EmptyStep>
			<EmptyStep number="03">템플릿으로 쓰기</EmptyStep>
		</Empty>
	),
};

/** No numbers when there is no order; a step can be a link (`href`, or the router's link in `render`). */
export const WithoutNumbers: Story = {
	render: (args) => (
		<Empty {...args}>
			<EmptyStep>첫 글 쓰기</EmptyStep>
			<EmptyStep href="#top">쓰던 글 가져오기</EmptyStep>
		</Empty>
	),
};

/** A search or filter that matches nothing: one step, to clear it. */
export const NothingMatches: Story = {
	render: () => (
		<Empty title="맞는 글이 없어요." description="다른 단어로 찾아보거나 걸어 둔 필터를 지워 보세요.">
			<EmptyStep>필터 지우기</EmptyStep>
		</Empty>
	),
};

export const TitleOnly: Story = { render: () => <Empty title="휴지통이 비어 있어요." /> };

/** The small form, for a popover or a dialog. */
export const Compact: Story = {
	decorators: [
		(Story) => (
			<div className="w-72 rounded-monti-xl border border-monti-emphasis">
				<Story />
			</div>
		),
	],
	render: () => <Empty size="compact" title="맞는 글이 없어요" description="다른 단어로 찾아보세요." />,
};
