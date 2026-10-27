import type { Meta, StoryObj } from "@storybook/react-vite";
import { Ellipsis, SquarePen } from "lucide-react";
import { Button } from "./button";
import { ChatInput } from "./chat-input";
import { ChatMessage } from "./chat-message";
import { Count } from "./count";
import { DescriptionItem, DescriptionList } from "./description-list";
import { IconButton } from "./icon-button";
import { SidePanelFrame } from "./side-panel-frame";
import { Spark } from "./spark";
import { Text } from "./text";
import { ToolCallLine } from "./tool-call-line";

/**
 * The panel beside a screen (the assistant, a media file, an activity): cream ground, a line down its left edge, a 60px head with the title (16px
 * bold) and icon buttons at the end, a body, and at the bottom one pill or the box to type in. It does not cover the screen next to it.
 */
const meta = {
	title: "Patterns/Sheet/SidePanel",
	component: SidePanelFrame,
	args: { title: "어시스턴트", children: null },
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<div className="flex h-svh w-monti-assistant">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof SidePanelFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

const input = (
	<ChatInput
		className="grow"
		value=""
		onValueChange={() => undefined}
		onSubmit={() => undefined}
		onStop={() => undefined}
		label="메시지"
		placeholder="이 글에 대해 물어보세요"
		sendLabel="보내기"
		stopLabel="멈추기"
	/>
);

export const TitleOnly: Story = { render: (args) => <SidePanelFrame {...args}>{null}</SidePanelFrame> };

/** The panel's actions sit before the close button. */
export const Header: Story = {
	render: (args) => (
		<SidePanelFrame
			{...args}
			onClose={() => undefined}
			actions={
				<IconButton label="새 대화" side="bottom">
					<SquarePen aria-hidden />
				</IconButton>
			}
		>
			{null}
		</SidePanelFrame>
	),
};

/** A media file: name and value rows in the body, a note and one small pill in the foot. */
export const Details: Story = {
	render: () => (
		<div className="flex w-monti-side-panel">
			<SidePanelFrame
				title="desk-morning.jpg"
				onClose={() => undefined}
				actions={
					<IconButton label="더 보기" side="bottom">
						<Ellipsis aria-hidden />
					</IconButton>
				}
				footer={
					<>
						<Count className="grow">쓰는 곳이 있어 지울 수 없어요</Count>
						<Button size="sm">저장</Button>
					</>
				}
			>
				<DescriptionList>
					<DescriptionItem label="종류">JPEG 이미지</DescriptionItem>
					<DescriptionItem label="크기">
						<Text mono>2400×1600 · 412 KB</Text>
					</DescriptionItem>
					<DescriptionItem label="쓰는 곳">첫 번째 글 외 1</DescriptionItem>
				</DescriptionList>
			</SidePanelFrame>
		</div>
	),
};

/** A body that is empty, and a foot that stays at the bottom. */
export const EmptyWithFooter: Story = {
	render: (args) => (
		<SidePanelFrame {...args} onClose={() => undefined} footer={input}>
			<Text tone="muted">
				<Spark aria-hidden /> 사이트에 대해 물어보세요
			</Text>
		</SidePanelFrame>
	),
};

/** A body longer than the panel scrolls, under the head and above the foot. */
export const Scrolling: Story = {
	render: (args) => (
		<SidePanelFrame {...args} onClose={() => undefined} footer={input}>
			{Array.from({ length: 8 }, (_, index) => (
				<div key={index} style={{ display: "contents" }}>
					<ChatMessage author="user">질문 {index + 1}</ChatMessage>
					<ToolCallLine status="done" statusLabel="끝남">
						글 목록 읽음 · 게시글 6편
					</ToolCallLine>
					<ChatMessage>질문 {index + 1}에 대한 답이에요. 패널 안에서 두 줄쯤 이어지도록 조금 길게 썼어요.</ChatMessage>
				</div>
			))}
		</SidePanelFrame>
	),
};

export const NoCloseButton: Story = {
	render: (args) => (
		<SidePanelFrame {...args} footer={<Button size="sm">저장</Button>}>
			{null}
		</SidePanelFrame>
	),
};
