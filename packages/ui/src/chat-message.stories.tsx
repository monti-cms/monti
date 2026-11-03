import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, ChatEntryLink, ChatEntryList, ChatMessage, Stack } from "./index";

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

/** An answer that names entries: a numbered list under its words, each name a link to the entry in the editor with its slug after it. */
export const EntryList: Story = {
	render: () => (
		<Stack gap={12}>
			<ChatMessage>요약이 빈 글은 두 편이에요.</ChatMessage>
			<ChatEntryList>
				<ChatEntryLink href="#edited-post" slug="/edited-post">
					발행 후 고친 글
				</ChatEntryLink>
				<ChatEntryLink href="#draft-post" slug="/draft-post">
					쓰는 중인 글
				</ChatEntryLink>
			</ChatEntryList>
		</Stack>
	),
};
