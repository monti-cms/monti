import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatMessage } from "./chat-message";
import { Stack } from "./stack";

const meta = {
	title: "Monti/Assistant/Message",
	component: ChatMessage,
	args: { author: "assistant", children: "Two posts are drafts. One entry I tried to open no longer exists." },
	argTypes: { author: { control: "inline-radio", options: ["user", "assistant"] } },
} satisfies Meta<typeof ChatMessage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** The admin's message is a quiet bubble; the assistant's answer is plain text. */
export const Roles: Story = {
	render: () => (
		<Stack gap={16} maxWidth="panel">
			<ChatMessage author="user">Which posts are drafts?</ChatMessage>
			<ChatMessage author="assistant">Two posts are drafts.</ChatMessage>
		</Stack>
	),
};

/** The answer is still arriving: a blinking mark after the last word. */
export const Streaming: Story = {
	args: { streaming: true, children: "Two posts are drafts, and one of them" },
};

/** Line breaks in the text are kept, and a long word wraps instead of widening the panel. */
export const LongText: Story = {
	render: () => (
		<Stack gap={16} maxWidth="panel">
			<ChatMessage author="user">
				{"First line\nSecond line\nhttps://example.com/a/very/long/address/that/has/no/spaces/at/all/and/keeps/going"}
			</ChatMessage>
			<ChatMessage>{"- one\n- two\n- three"}</ChatMessage>
		</Stack>
	),
};
