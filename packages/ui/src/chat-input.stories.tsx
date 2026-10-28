import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Caret } from "./caret";
import { ChatInput } from "./chat-input";
import { TextButton } from "./text-button";

const meta = {
	title: "Monti/Assistant/Input",
	component: ChatInput,
	args: {
		value: "",
		onValueChange: () => undefined,
		onSubmit: () => undefined,
		onStop: () => undefined,
		label: "메시지",
		placeholder: "어시스턴트에게 물어보세요",
		sendLabel: "보내기",
		stopLabel: "멈추기",
	},
	decorators: [
		(Story) => (
			<div style={{ maxWidth: 360 }}>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof ChatInput>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Type and press Enter (Shift+Enter breaks the line). */
export const Playground: Story = {
	render: (args) => {
		const [value, setValue] = useState("");
		return <ChatInput {...args} value={value} onValueChange={setValue} onSubmit={() => setValue("")} />;
	},
};

/** Nothing to send yet: the send button is off. */
export const Empty: Story = {};

export const WithText: Story = { args: { value: "초안인 글이 뭐야?" } };

/** The answer is being written: the button stops it. */
export const Busy: Story = { args: { value: "", busy: true } };

/** The assistant can't run: the box is off. */
export const Disabled: Story = { args: { disabled: true, placeholder: "먼저 연결을 추가하세요" } };

/** The model picker sits at the start of the row, the round send button at the end. */
export const WithModelPicker: Story = {
	args: {
		value: "요약이 비어 있는 글 찾아 줘",
		aside: (
			<TextButton variant="quiet" mono className="text-monti-meta">
				claude-sonnet-5-5
				<Caret />
			</TextButton>
		),
	},
};
