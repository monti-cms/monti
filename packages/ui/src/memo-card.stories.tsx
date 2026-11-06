import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import {
	Box,
	Highlight,
	Marker,
	MemoCard,
	MemoCardPopover,
	MemoDiff,
	MemoMessage,
	MemoThread,
	RequestAnchor,
	Text,
} from "./index";

const noop = () => {};

/**
 * The card under a mark in the text: the head (discard, then one black pill to accept), the thread or a before/after, and the reply row. There is no
 * close button.
 */
const meta = {
	title: "Monti/Proposal/MemoCard",
	component: MemoCard,
} satisfies Meta<typeof MemoCard>;
export default meta;
type Story = StoryObj<typeof meta>;

function useReply(placeholder: string, extra: { focus?: boolean; stop?: { label: string; onStop: () => void } } = {}) {
	const [value, setValue] = useState("");
	return { placeholder, value, onValueChange: setValue, onSend: () => setValue(""), sendLabel: "보내기", ...extra };
}

/** A note with the assistant's answer waiting: accept or discard in the head, go on in the reply row. */
export const Thread: Story = {
	render: function Render() {
		const reply = useReply("이어서 쓰기");
		return (
			<MemoCard
				discardLabel="버리기"
				onDiscard={noop}
				discardShortcut={["mod", "Backspace"]}
				acceptLabel="받기"
				onAccept={noop}
				acceptShortcut={["mod", "Enter"]}
				reply={reply}
			>
				<MemoThread>
					<MemoMessage author="나" time="10:41">
						이 문장을 더 짧게 줄여 줘
					</MemoMessage>
					<MemoMessage author="어시스턴트" time="10:41" ai>
						“Monti는 코드 없이 사이트를 고치게 합니다.”로 줄였어요.
					</MemoMessage>
				</MemoThread>
			</MemoCard>
		);
	},
};

/** The assistant is working: its message is "…" and the reply row's button stops it. */
export const Working: Story = {
	render: function Render() {
		const reply = useReply("이어서 쓰기", { stop: { label: "멈추기", onStop: noop } });
		return (
			<MemoCard discardLabel="버리기" onDiscard={noop} acceptLabel="받기" onAccept={noop} reply={reply}>
				<MemoThread>
					<MemoMessage author="나" time="10:41">
						이 문장을 더 짧게 줄여 줘
					</MemoMessage>
					<MemoMessage author="어시스턴트" ai>
						…
					</MemoMessage>
				</MemoThread>
			</MemoCard>
		);
	},
};

/** Words just selected to ask about: nothing to deal with yet, so no head; it opens with the caret in the reply row. */
export const NewRequest: Story = {
	render: function Render() {
		const reply = useReply("어시스턴트에게 요청", { focus: true });
		return <MemoCard reply={reply} />;
	},
};

/** A translated block whose source changed: what kind it is in the head, the source before and after, and accepting asks again ("✦ 다시 번역"). */
export const SourceChanged: Story = {
	render: () => (
		<MemoCard
			where="원문 변경"
			discardLabel="확인"
			onDiscard={noop}
			acceptLabel="다시 번역"
			onAccept={noop}
			acceptSpark
		>
			<MemoDiff
				beforeLabel="전"
				afterLabel="후"
				before={
					<>
						왼쪽 목록에서 컬렉션을 <Highlight>고릅니다</Highlight>.
					</>
				}
				after={
					<>
						왼쪽 목록에서 컬렉션을 <Highlight>고르고 새 글을 씁니다</Highlight>.
					</>
				}
			/>
		</MemoCard>
	),
};

/** A block new in the source: only its words, and bringing it in (it comes in dimmed) or leaving it out of this language. */
export const SourceAdded: Story = {
	render: () => (
		<MemoCard where="새로" discardLabel="빼기" onDiscard={noop} acceptLabel="넣기" onAccept={noop}>
			<MemoDiff afterLabel="원문" after="다음 글에서는 번역을 다룬다." />
		</MemoCard>
	),
};

/** Opened under its place in the text: hangs 8px below the block of the mark; the text keeps the focus. */
export const UnderText: Story = {
	render: function Render() {
		const [open, setOpen] = useState(true);
		const reply = useReply("이어서 쓰기");
		return (
			<Box width="reading" paddingX={48} paddingY={24}>
				<Box id="memo-anchor" position="relative">
					<Marker tone="request" margin active={open} onClick={() => setOpen(!open)}>
						2
					</Marker>
					<Text as="p" variant="reading">
						Monti는 글을 쓰는 사람이 <RequestAnchor>설정 파일을 열지 않아도</RequestAnchor> 사이트를 고칠 수 있게
						합니다.
					</Text>
				</Box>
				<MemoCardPopover
					anchor={() => document.getElementById("memo-anchor")}
					open={open}
					onOpenChange={setOpen}
					discardLabel="버리기"
					onDiscard={noop}
					acceptLabel="받기"
					onAccept={noop}
					reply={reply}
				>
					<MemoThread>
						<MemoMessage author="나" time="10:41">
							이 말을 더 쉽게 바꿔 줘
						</MemoMessage>
						<MemoMessage author="어시스턴트" time="10:42" ai>
							“코드를 몰라도”로 바꿨어요.
						</MemoMessage>
					</MemoThread>
				</MemoCardPopover>
			</Box>
		);
	},
};

/** A block gone from the source: its words before, and after it "지워짐" in the faint ink of nothing, so it never reads as the new words. */
export const SourceRemoved: Story = {
	render: () => (
		<MemoCard where="원문에서 지워짐" discardLabel="확인" onDiscard={noop} acceptLabel="지우기" onAccept={noop}>
			<MemoDiff beforeLabel="전" afterLabel="후" before="목록에는 제목과 주소, 상태만 남겼다." none="지워짐" />
		</MemoCard>
	),
};
