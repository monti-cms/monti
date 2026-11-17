import type { Meta, StoryObj } from "@storybook/react-vite";
import { Chip } from "./chip";
import { Inline, Stack } from "./stack";
import { StoryCaption } from "./story-caption";

/**
 * A condition that is on, or a value that was picked. The default size (28px) is a list's filter; `size="sm"` (24px) is a value inside a field
 * (a tag). `onRemove` adds the × that takes it off; `proposal` is one the assistant set.
 */
const meta = {
	title: "Controls/Choice/Chip",
	component: Chip,
	args: { children: "리액트" },
} satisfies Meta<typeof Chip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** Both sizes side by side, with and without the ×. */
export const Sizes: Story = {
	render: () => (
		<Stack gap={16}>
			<Stack gap={6}>
				<StoryCaption>기본 · 28px · 목록의 필터</StoryCaption>
				<Inline gap={6}>
					<Chip>상태: 발행됨</Chip>
					<Chip onRemove={() => {}} removeLabel="상태 조건 빼기">
						상태: 발행됨
					</Chip>
				</Inline>
			</Stack>
			<Stack gap={6}>
				<StoryCaption>sm · 24px · 필드 안의 값(태그)</StoryCaption>
				<Inline gap={6}>
					<Chip size="sm">리액트</Chip>
					<Chip size="sm" onRemove={() => {}} removeLabel="리액트 빼기">
						리액트
					</Chip>
				</Inline>
			</Stack>
		</Stack>
	),
};

/** The assistant set it and nobody has touched it: a spark first, the proposal colors, a blue ×. */
export const Proposal: Story = {
	render: () => (
		<Inline gap={6}>
			<Chip proposal onRemove={() => {}} removeLabel="프론트엔드 빼기">
				프론트엔드
			</Chip>
			<Chip size="sm" proposal onRemove={() => {}} removeLabel="프론트엔드 빼기">
				프론트엔드
			</Chip>
		</Inline>
	),
};
