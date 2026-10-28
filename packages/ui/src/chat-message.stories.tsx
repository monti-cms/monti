import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatMessage } from "./chat-message";
import { Stack } from "./stack";

const meta = {
	title: "Monti/Assistant/Message",
	component: ChatMessage,
	args: { author: "assistant", children: "초안인 글은 두 편이에요. 열어 보려던 글 하나는 이제 없어요." },
	argTypes: { author: { control: "inline-radio", options: ["user", "assistant"] } },
} satisfies Meta<typeof ChatMessage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The admin's message is a quiet bubble; the assistant's answer is plain text. */
export const Roles: Story = {
	render: () => (
		<Stack gap={16} maxWidth="panel">
			<ChatMessage author="user">초안인 글이 뭐야?</ChatMessage>
			<ChatMessage author="assistant">초안인 글은 두 편이에요.</ChatMessage>
		</Stack>
	),
};

/** The answer is still arriving: a thin blinking caret after the last word. */
export const Streaming: Story = {
	args: { streaming: true, children: "초안인 글은 두 편이고, 그중 하나는" },
};

/** Answers are plain text, not markdown: line breaks are kept and a long word wraps instead of widening the panel. */
export const LongText: Story = {
	render: () => (
		<Stack gap={16} maxWidth="panel">
			<ChatMessage author="user">
				{"첫 줄\n둘째 줄\nhttps://example.com/a/very/long/address/that/has/no/spaces/at/all/and/keeps/going"}
			</ChatMessage>
			<ChatMessage>{"초안인 글은 두 편이에요.\n하나는 쓰는 중이고, 하나는 발행한 뒤에 고친 글이에요."}</ChatMessage>
		</Stack>
	),
};
