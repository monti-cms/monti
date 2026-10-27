import type { Meta, StoryObj } from "@storybook/react-vite";
import { Empty, EmptyStep } from "./empty";

/**
 * What a list shows when it is empty: a line that says so and then what can be done, in order. No box, no explanation. The numbers are only for steps
 * whose order really matters.
 */
const meta = {
	title: "Patterns/List/Empty",
	component: Empty,
	args: { title: "아직 글이 없어요." },
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
		<Empty title="맞는 글이 없어요.">
			<EmptyStep>필터 지우기</EmptyStep>
		</Empty>
	),
};

export const TitleOnly: Story = { render: () => <Empty title="휴지통이 비어 있어요." /> };
