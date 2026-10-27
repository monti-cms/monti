import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChatError } from "./chat-error";
import { Stack } from "./stack";
import { TextButton } from "./text-button";

/**
 * An answer that could not be given, in the conversation: a red line on the left, the problem, one grey line of detail and what can be done next.
 * Sending is never blocked beforehand; this is what comes back after.
 */
const meta = {
	title: "Assistant/Error",
	component: ChatError,
	args: {
		title: "이번 달 상한에 닿아서 보내지 못했어요",
		children: "Anthropic 개인 · $10.00 / $10 · 11월 1일에 다시 열려요",
	},
	decorators: [
		(Story) => (
			<Stack className="max-w-sm">
				<Story />
			</Stack>
		),
	],
} satisfies Meta<typeof ChatError>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	args: {
		actions: (
			<>
				<TextButton variant="underline">다른 모델로 보내기</TextButton>
				<TextButton>상한 바꾸기</TextButton>
			</>
		),
	},
};

/** The connection dropped: how far it got, and one way on. */
export const Disconnected: Story = {
	args: {
		title: "연결이 끊겼어요",
		children: "글 3편까지 읽었어요.",
		actions: <TextButton variant="underline">이어서 하기</TextButton>,
	},
};

/** Only the problem. */
export const TitleOnly: Story = { args: { children: undefined } };
