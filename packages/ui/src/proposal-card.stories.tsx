import type { Meta, StoryObj } from "@storybook/react-vite";
import { ProposalCard, ProposalItem } from "./proposal-card";
import { Ins } from "./proposal-marks";

/**
 * A proposal in the conversation: what changes and how much, the places with the blue pencil on them, and under them review, discard and a black Apply.
 * Once applied the line says so, with the time and a way back.
 */
const meta = {
	title: "Chat/Proposal card",
	component: ProposalCard,
	args: {
		title: "제안",
		summary: "요약 채우기 · 글 2편",
		status: "검토 대기",
		reviewLabel: "검토",
		onReview: () => undefined,
		discardLabel: "버리기",
		onDiscard: () => undefined,
		applyLabel: "적용",
		onApply: () => undefined,
		children: null,
	},
	decorators: [
		(Story) => (
			<div className="w-[340px]">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof ProposalCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
	render: (args) => (
		<ProposalCard {...args}>
			<ProposalItem title="발행 후 고친 글">
				<Ins>예시 코드를 고친 뒤 다시 정리한 메모.</Ins>
			</ProposalItem>
		</ProposalCard>
	),
};

/** Several places. */
export const SeveralPlaces: Story = {
	render: (args) => (
		<ProposalCard {...args}>
			<ProposalItem title="발행 후 고친 글">
				<Ins>예시 코드를 고친 뒤 다시 정리한 메모.</Ins>
			</ProposalItem>
			<ProposalItem title="여름 여행 기록">
				<Ins>여름에 다녀온 곳을 짧게 적은 기록.</Ins>
			</ProposalItem>
		</ProposalCard>
	),
};

/** After Apply: the buttons give way to a line that says what happened, and a way back. */
export const Applied: Story = {
	args: { status: undefined, appliedLabel: "2편에 적용 · 10:52", undoLabel: "되돌리기", onUndo: () => undefined },
	render: (args) => (
		<ProposalCard {...args}>
			<ProposalItem title="발행 후 고친 글">예시 코드를 고친 뒤 다시 정리한 메모.</ProposalItem>
		</ProposalCard>
	),
};
