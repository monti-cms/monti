import type { Meta, StoryObj } from "@storybook/react-vite";
import { Banner } from "./banner";
import { Button } from "./button";
import { PageHeader } from "./page-header";
import { TextButton } from "./text-button";

/**
 * A one-line notice across the top of a pane (the Korean source changed): the sentence in the warning color, a small detail in mono, and what can be
 * done about it at the right end. Cream background, one rule below.
 */
const meta = {
	title: "Frame/Banner",
	component: Banner,
	args: { title: "한국어 원문이 바뀌었어요", meta: "10. 26 · 블록 2개" },
} satisfies Meta<typeof Banner>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<Banner {...args}>
			<TextButton variant="underline">비교</TextButton>
			<TextButton>확인했어요</TextButton>
		</Banner>
	),
};

/** Only the sentence, with nothing to do about it. */
export const TitleOnly: Story = { args: { meta: undefined } };

/** A long sentence and a long detail share the line; the actions keep their place. */
export const Narrow: Story = {
	render: (args) => (
		<div className="max-w-md">
			<Banner {...args} meta="10. 26 · 블록 2개 · 원문 버전 7">
				<TextButton variant="underline">비교</TextButton>
				<TextButton>확인했어요</TextButton>
			</Banner>
		</div>
	),
};

/** Under a page header, across the pane's width. */
export const UnderHeader: Story = {
	render: (args) => (
		<div>
			<div className="px-monti-24 pt-monti-24">
				<PageHeader title="여름 여행 기록" meta="/posts/summer-trip">
					<Button>발행하기</Button>
				</PageHeader>
			</div>
			<Banner {...args} className="mt-monti-16">
				<TextButton variant="underline">비교</TextButton>
				<TextButton>확인했어요</TextButton>
			</Banner>
		</div>
	),
};
