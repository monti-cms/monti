import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Box, Marker, ProposalBubble, ProposalBubbleDock, Stack, Text } from "./index";

const noop = () => {};

/**
 * The bubble over the status bar while proposals wait: ✦ and the request's words (press to open that conversation), ↑ n / N ↓, then "모두 버리기"
 * and the small pill "모두 받기". One proposal at a time is handled in the card its mark opens, not here.
 */
const meta = {
	title: "Monti/Proposal/ProposalBubble",
	component: ProposalBubble,
	args: {
		name: "요약이 빈 글에 요약 채우기",
		onOpen: noop,
		position: 2,
		total: 5,
		previousLabel: "이전 제안",
		nextLabel: "다음 제안",
		onPrevious: noop,
		onNext: noop,
		discardAllLabel: "모두 버리기",
		onDiscardAll: noop,
		acceptAllLabel: "모두 받기",
		onAcceptAll: noop,
	},
} satisfies Meta<typeof ProposalBubble>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** A long request is cut with …; the full words are its title. */
export const LongName: Story = {
	args: { name: "발행 뒤에 고친 글의 문장을 다듬고 맞춤법과 띄어쓰기를 바로잡아 줘" },
};

/** One proposal: the steps are off. */
export const Single: Story = { args: { position: 1, total: 1 } };

/** Without a conversation to open, the name is plain blue text. */
export const WithoutConversation: Story = { args: { onOpen: undefined } };

/** In its dock at the bottom of the editor column: the text scrolls under it. */
export const InDock: Story = {
	render: function Render(args) {
		const [position, setPosition] = useState(args.position);
		return (
			<Box maxHeight="half" overflow="auto" border="all" width="reading">
				<Stack gap={20} padding={24}>
					{Array.from({ length: 12 }, (_, index) => (
						<Text key={index} as="p" variant="reading">
							단풍이 시작된 산길을 하루 동안 걸었습니다. 바람이 차가워지고 있었습니다.
						</Text>
					))}
				</Stack>
				<ProposalBubbleDock>
					<ProposalBubble
						{...args}
						position={position}
						onPrevious={() => setPosition((value) => Math.max(1, value - 1))}
						onNext={() => setPosition((value) => Math.min(args.total, value + 1))}
					/>
				</ProposalBubbleDock>
			</Box>
		);
	},
};

/**
 * A screen whose proposals have no one place to hang a mark at (the settings): the mark of the proposal the bubble points at stands
 * before the bubble, and opens that proposal's card.
 */
export const WithMark: Story = {
	render: (args) => (
		<Box maxHeight="half" overflow="auto" border="all" width="reading">
			<Stack gap={20} padding={24}>
				{Array.from({ length: 6 }, (_, index) => (
					<Text key={index} as="p" variant="reading">
						단풍이 시작된 산길을 하루 동안 걸었습니다. 바람이 차가워지고 있었습니다.
					</Text>
				))}
			</Stack>
			<ProposalBubbleDock>
				<Marker aria-label="제안: 요약이 빈 글에 요약 채우기" onClick={noop}>
					1
				</Marker>
				<ProposalBubble {...args} />
			</ProposalBubbleDock>
		</Box>
	),
};
