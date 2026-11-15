import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Box, ChatInput, ChatQueueItem, Chip, ModelMenuButton, ThinkingMenu } from "./index";

/**
 * The assistant's box: the text area, the model button at the bottom left, the round send button at the right (a stop button while the answer is
 * written). Enter sends, Shift+Enter breaks the line. With an empty text only the send button dims.
 */
const meta = {
	title: "Monti/Assistant/ChatInput",
	component: ChatInput,
	args: {
		value: "",
		onValueChange: () => {},
		onSubmit: () => {},
		onStop: () => {},
		label: "어시스턴트에게 요청",
		placeholder: "무엇을 할까요?",
		sendLabel: "보내기",
		stopLabel: "멈추기",
	},
	decorators: [
		(Story) => (
			<Box width="assistant" padding={16} background="tool">
				<Story />
			</Box>
		),
	],
} satisfies Meta<typeof ChatInput>;
export default meta;
type Story = StoryObj<typeof meta>;

const LEVELS = [
	{ value: "off", label: "끔" },
	{ value: "low", label: "낮음" },
	{ value: "medium", label: "보통" },
	{ value: "high", label: "높음" },
];

const model = (
	<>
		<ModelMenuButton model="Claude Sonnet 5.5" label="모델 고르기" />
		<ThinkingMenu value="medium" options={LEVELS} onValueChange={() => {}} label="생각" text="생각 보통" />
	</>
);

function Live(props: Partial<React.ComponentProps<typeof ChatInput>> & { initial?: string }) {
	const [value, setValue] = useState(props.initial ?? "");
	return (
		<ChatInput
			label="어시스턴트에게 요청"
			placeholder="무엇을 할까요?"
			sendLabel="보내기"
			stopLabel="멈추기"
			onSubmit={() => setValue("")}
			onStop={() => {}}
			aside={model}
			{...props}
			value={value}
			onValueChange={setValue}
		/>
	);
}

/** Empty: the send button is dim. */
export const Empty: Story = { render: () => <Live /> };

export const Typed: Story = { render: () => <Live initial="요약이 빈 글에 요약을 채워 줘" /> };

/** While the answer is written the send button is the stop button. */
export const Busy: Story = { render: () => <Live initial="" busy /> };

/** Rows picked in the list go with the request: a chip over the text, × leaves them out. */
export const WithContext: Story = {
	render: () => (
		<Live
			context={
				<Chip onRemove={() => {}} removeLabel="빼기">
					고른 글 2편
				</Chip>
			}
		/>
	),
};

/** A model name longer than the row is cut before the thinking button and the send button: nothing runs on under them (AS-41). */
export const LongModel: Story = {
	render: () => (
		<Live
			aside={
				<>
					<ModelMenuButton
						model="Nous: Hermes 4 405B Instruct Turbo Preview (extended context, free)"
						label="모델 고르기"
					/>
					<ThinkingMenu value="medium" options={LEVELS} onValueChange={() => {}} label="생각" text="생각 보통" />
				</>
			}
		/>
	),
};

/** The box cannot send. */
export const Disabled: Story = { render: () => <Live initial="요약을 채워 줘" disabled /> };

/** While the answer is written, what the admin sends waits over the text: send now, edit, cancel. */
export const BusyWithQueue: Story = {
	render: () => (
		<Live
			busy
			busyPlaceholder="더 말하기"
			onQueue={() => {}}
			queue={["회고 글은 빼고 옮겨 줘", "사진 글도 빼 줘"].map((words) => (
				<ChatQueueItem
					key={words}
					sendNowLabel="지금 보내기"
					editLabel="고치기"
					cancelLabel="취소"
					onSendNow={() => {}}
					onEdit={() => {}}
					onCancel={() => {}}
				>
					{words}
				</ChatQueueItem>
			))}
		/>
	),
};
