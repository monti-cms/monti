import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Marker } from "./marker";
import { MemoCard, MemoDiff, MemoMessage, MemoThread } from "./memo-card";
import { Highlight } from "./proposal-marks";
import { Stack } from "./stack";
import { Text } from "./text";

/**
 * The card that opens under a mark in the text. The head says where the note is, then a quiet discard and one black accept, in that order (no close
 * button: outside, Esc or the mark again closes it). The body is the conversation of the note or, for a changed source, the text before and after. The reply row
 * continues the note. Hover the head's buttons for their key combinations.
 */
const meta = {
	title: "Monti/Proposal/MemoCard",
	component: MemoCard,
	args: {
		where: "요청 · 문단 4",
		discardLabel: "버리기",
		discardShortcut: ["mod", "Backspace"],
		onDiscard: () => undefined,
		acceptLabel: "받기",
		acceptShortcut: ["mod", "Enter"],
		onAccept: () => undefined,
		children: null,
	},
} satisfies Meta<typeof MemoCard>;
export default meta;
type Story = StoryObj<typeof meta>;

function useReply() {
	const [value, setValue] = useState("");
	return {
		placeholder: "이어서 요청",
		value,
		onValueChange: setValue,
		onSend: () => setValue(""),
		sendLabel: "보내기",
	};
}

function Thread() {
	return (
		<MemoThread>
			<MemoMessage author="나" time="10:58">
				예시 하나 붙여 줘.
			</MemoMessage>
			<MemoMessage author="어시스턴트" ai time="고치는 중…" />
		</MemoThread>
	);
}

function WithReply(args: Story["args"]) {
	const reply = useReply();
	return (
		<MemoCard {...(args as Required<NonNullable<Story["args"]>>)} reply={reply}>
			<Thread />
		</MemoCard>
	);
}

export const Playground: Story = { render: (args) => <WithReply {...args} /> };

/** The mark in the margin and the card under it, as in the editor. */
export const UnderMark: Story = {
	render: (args) => (
		<Stack gap={12} className="max-w-md">
			<div className="flex items-center gap-monti-10">
				<Marker tone="request" active onClick={() => undefined}>
					1
				</Marker>
				<Text>
					<Highlight>설정 화면은 그대로 두었다.</Highlight> 자주 바꾸지 않는 것까지…
				</Text>
			</div>
			<WithReply {...args} />
		</Stack>
	),
};

/** A longer conversation: the discard and accept stay in the head. */
export const LongThread: Story = {
	render: (args) => {
		const reply = useReply();
		return (
			<MemoCard {...(args as Required<NonNullable<Story["args"]>>)} reply={reply}>
				<MemoThread>
					<MemoMessage author="나" time="10:58">
						예시 하나 붙여 줘.
					</MemoMessage>
					<MemoMessage author="어시스턴트" ai time="10:58">
						설정 화면 예시로 "사이트 이름을 바꾸는 방법"을 넣었어요.
					</MemoMessage>
					<MemoMessage author="나" time="11:02">
						더 짧게. 한 문장으로.
					</MemoMessage>
					<MemoMessage author="어시스턴트" ai time="고치는 중…" />
				</MemoThread>
			</MemoCard>
		);
	},
};

/** A translated block whose source changed: the text before and after (the words that differ marked), and "Confirm" and "Translate again". */
export const SourceChanged: Story = {
	args: {
		where: "원문 바뀜 · 문단 2",
		discardLabel: "확인",
		discardShortcut: undefined,
		acceptLabel: "다시 번역",
		acceptShortcut: undefined,
		acceptSpark: true,
	},
	render: (args) => (
		<MemoCard {...args}>
			<MemoDiff
				beforeLabel="전"
				afterLabel="후"
				before={
					<>
						나머지는 <Highlight>필요할 때 꺼내 본다.</Highlight>
					</>
				}
				after={
					<>
						나머지는 <Highlight>접어 두고 필요할 때 펼친다.</Highlight>
					</>
				}
			/>
		</MemoCard>
	),
};
