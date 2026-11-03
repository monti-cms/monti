import type { Meta, StoryObj } from "@storybook/react-vite";
import { SendButton } from "./send-button";
import { Stack } from "./stack";

/** The round black button that sends a message. While the answer is being written (`busy`) it stops it, with a square. */
const meta = {
	title: "Controls/Button/SendButton",
	component: SendButton,
	args: { label: "보내기" },
} satisfies Meta<typeof SendButton>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** `md` in the assistant's composer, `sm` (28px) in a note's reply row; busy; disabled while there is nothing to send. */
export const States: Story = {
	render: () => (
		<Stack direction="row" gap={16} align="center">
			<SendButton label="보내기" />
			<SendButton label="보내기" size="sm" />
			<SendButton label="멈추기" busy />
			<SendButton label="보내기" disabled />
		</Stack>
	),
};
