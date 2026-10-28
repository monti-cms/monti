import { ChevronLeft } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Banner } from "./banner";
import { Text } from "./text";
import { TextButton } from "./text-button";

/**
 * A one-line notice across the top of a pane (the Korean source changed): the sentence in the warning color, a small detail in mono, and what can be
 * done about it at the right end. Cream background, one rule below.
 */
const meta = {
	title: "Patterns/Frame/Banner",
	component: Banner,
	args: { title: "한국어 원문이 바뀌었어요", meta: "10. 26 · 블록 2개" },
	parameters: { bleed: true },
} satisfies Meta<typeof Banner>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<Banner {...args}>
			<TextButton variant="underline">비교</TextButton>
			<TextButton>확인</TextButton>
		</Banner>
	),
};

/** Warning (the default): the sentence in the warning text color, the dot in the warning mark color. */
export const Warning: Story = {
	render: (args) => (
		<Banner {...args} tone="warning">
			<TextButton variant="underline">비교</TextButton>
			<TextButton>확인</TextButton>
		</Banner>
	),
};

/** Danger, for something that failed rather than something to know: the sentence and the dot are red. */
export const Danger: Story = {
	render: (args) => (
		<Banner {...args} tone="danger" title="전송하지 못했어요" meta="10. 26 · 3번 시도">
			<TextButton variant="underline">다시 보내기</TextButton>
			<TextButton>닫기</TextButton>
		</Banner>
	),
};

/** Neutral, for a state that is neither a warning nor a failure (an entry in the trash): the sentence, the dot and a plain detail are subtle. */
export const Neutral: Story = {
	args: { tone: "neutral", title: "휴지통에 있는 글이에요", meta: "복원하면 초안으로 돌아와요 · 23일 남음" },
};

/** Only the sentence, with nothing to do about it. */
export const TitleOnly: Story = { args: { meta: undefined } };

/** On a narrow screen the detail gives way first; the sentence and the actions stay whole on one line. */
export const Narrow: Story = {
	render: (args) => (
		<div className="max-w-md">
			<Banner {...args} meta="10. 26 · 블록 2개 · 원문 버전 7">
				<TextButton variant="underline">비교</TextButton>
				<TextButton>확인</TextButton>
			</Banner>
		</div>
	),
};

/** Directly under the editor's top bar, across the pane's width, with no gap: the bar's rule is the banner's top edge. */
export const UnderHeader: Story = {
	render: (args) => (
		<div>
			<header className="flex h-monti-header flex-wrap items-center gap-monti-12 border-monti-default border-b pr-monti-12 pl-monti-24">
				<TextButton variant="quiet">
					<ChevronLeft aria-hidden />
					게시글
				</TextButton>
				<Text variant="meta" tone="faint">
					/posts/summer-trip
				</Text>
			</header>
			<Banner {...args}>
				<TextButton variant="underline">비교</TextButton>
				<TextButton>확인</TextButton>
			</Banner>
		</div>
	),
};
