import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { ProposalBubble } from "./proposal-bubble";
import { Stack } from "./stack";

/**
 * The pill over the status bar while proposals wait: the request's name (press it to open that conversation), "↑ 2 / 5 ↓" to step through the places,
 * discard all and accept all. 44px tall. Accepting, discarding or asking again about one proposal is in the card that opens from its mark, not here.
 */
const meta = {
	title: "Monti/Proposal/Bubble",
	component: ProposalBubble,
	args: {
		name: "더 짧게 다듬기",
		position: 1,
		total: 5,
		previousLabel: "이전 제안",
		nextLabel: "다음 제안",
		discardAllLabel: "모두 버리기",
		acceptAllLabel: "모두 받기",
		onOpen: () => undefined,
		onPrevious: () => undefined,
		onNext: () => undefined,
		onDiscardAll: () => undefined,
		onAcceptAll: () => undefined,
	},
} satisfies Meta<typeof ProposalBubble>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => {
		const [position, setPosition] = useState(1);
		return (
			<ProposalBubble
				{...args}
				position={position}
				onPrevious={() => setPosition((value) => (value === 1 ? args.total : value - 1))}
				onNext={() => setPosition((value) => (value === args.total ? 1 : value + 1))}
			/>
		);
	},
};

/** One proposal: nothing to step through. And a long request name keeps the pill on one line. */
export const OneProposal: Story = {
	render: (args) => (
		<Stack gap={16} align="start">
			<ProposalBubble {...args} position={1} total={1} />
			<ProposalBubble {...args} name="태그가 비어 있는 글 모두 채워서 보여 줘" position={3} total={12} />
		</Stack>
	),
};

/** Without a way to open the conversation the name is plain. */
export const NotOpenable: Story = { args: { onOpen: undefined } };
