import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, ChatMessage } from "./index";

/** A message: the admin's on the right in a paper bubble, the assistant's as plain text with no ground. */
const meta = {
	title: "Monti/Assistant/ChatMessage",
	component: ChatMessage,
	decorators: [
		(Story) => (
			<Box width="assistant" padding={24} background="tool">
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof ChatMessage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const User: Story = { args: { author: "user", children: "요약이 빈 글에 요약을 채워 줘" } };

/** Asked about rows picked in a list: "고른 글 2편" over the words. */
export const UserWithContext: Story = {
	args: { author: "user", context: "고른 글 2편", children: "이 글들에 태그를 달아 줘" },
};

/** Sent by a screen's button (a default request): a blue spark before the words. */
export const UserRequest: Story = { args: { author: "user", request: true, children: "대체 텍스트 채우기" } };

export const Assistant: Story = {
	args: { author: "assistant", children: "요약이 빈 글 11편을 찾았어요. 요약을 채운 제안을 만들었어요." },
};

/** The answer is still coming: a thin blinking caret after the last word. */
export const Streaming: Story = { args: { author: "assistant", streaming: true, children: "요약이 빈 글 11편을 찾" } };
