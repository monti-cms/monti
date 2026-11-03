import type { Meta, StoryObj } from "@storybook/react-vite";
import { Empty, EmptyStep } from "./index";

/** What an empty list shows: a line that says so and, instead of an explanation, the things that can be done, in order. No box. */
const meta = {
	title: "Patterns/List/Empty",
	component: Empty,
} satisfies Meta<typeof Empty>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Steps without numbers. */
export const Steps: Story = {
	args: {
		title: "아직 글이 없어요",
		children: (
			<>
				<EmptyStep>새 글 쓰기</EmptyStep>
				<EmptyStep href="#">마크다운 가져오기</EmptyStep>
			</>
		),
	},
};

/** Numbered steps, only when the order really matters; a quiet line under the title when the steps cannot say what is missing. */
export const Ordered: Story = {
	args: {
		title: "번역을 시작할 수 없어요",
		description: "사이트에 두 번째 언어가 없어요.",
		children: (
			<>
				<EmptyStep number="01">언어 추가</EmptyStep>
				<EmptyStep number="02">번역할 글 고르기</EmptyStep>
			</>
		),
	},
};
