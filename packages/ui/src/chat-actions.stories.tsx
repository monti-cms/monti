import type { Meta, StoryObj } from "@storybook/react-vite";
import { Copy, Edit, Renew } from "./icons";
import { Box, ChatMessage, ChatMessageActions, ChatThread, IconButton } from "./index";

/**
 * The row under a message: its time and icon-only buttons, shown only while the pointer or keyboard is on the message.
 * The `Hovered` story forces the pointer onto the first message with `storybook-addon-pseudo-states`.
 */
const meta = {
	title: "Monti/Assistant/ChatMessageActions",
	component: ChatMessageActions,
	args: { author: "user" },
	decorators: [
		(Story) => (
			<Box width="assistant" background="page">
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof ChatMessageActions>;
export default meta;
type Story = StoryObj<typeof meta>;

const userActions = (
	<>
		<IconButton label="복사">
			<Copy />
		</IconButton>
		<IconButton label="고쳐서 다시 보내기">
			<Edit />
		</IconButton>
	</>
);
const assistantActions = (
	<>
		<IconButton label="복사">
			<Copy />
		</IconButton>
		<IconButton label="다시 하기">
			<Renew />
		</IconButton>
	</>
);

function Thread() {
	return (
		<ChatThread id="thread">
			<ChatMessage author="user">요약이 비어 있는 글 찾아 줘</ChatMessage>
			<ChatMessageActions author="user" time="오후 3:12">
				{userActions}
			</ChatMessageActions>
			<ChatMessage author="assistant">요약이 빈 글은 두 편이에요.</ChatMessage>
			<ChatMessageActions author="assistant" time="오후 3:12">
				{assistantActions}
			</ChatMessageActions>
		</ChatThread>
	);
}

/** At rest no row shows. */
export const Default: Story = { render: () => <Thread /> };

/** The pointer on the admin's message: its row shows at the right. */
export const Hovered: Story = {
	parameters: { pseudo: { hover: ["#thread [data-slot=chat-message]:first-child"] } },
	render: () => <Thread />,
};
