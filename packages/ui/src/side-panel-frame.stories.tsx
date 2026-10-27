import type { Meta, StoryObj } from "@storybook/react-vite";
import { Ellipsis, SquarePen } from "lucide-react";
import { Button } from "./button";
import { ChatInput } from "./chat-input";
import { ChatMessage } from "./chat-message";
import { DescriptionItem, DescriptionList } from "./description-list";
import { IconButton } from "./icon-button";
import { SidePanelFrame } from "./side-panel-frame";
import { Stack } from "./stack";
import { Suggest } from "./suggest";
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
	parameters: { layout: "fullscreen", bleed: true },
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
						<span className="grow text-monti-note text-monti-subtle">쓰는 곳이 있어 지울 수 없어요</span>
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

/**
 * The assistant's empty panel: no text of its own. The body holds requests to start from, pushed down to just above the input: the group
 * "이 글에서" (saved requests) and "최근" (asked before). The frame's body padding is taken back so the groups sit 12px from the panel's edges and 4px above the input.
 */
export const Empty: Story = {
	render: (args) => (
		<SidePanelFrame {...args} onClose={() => undefined} footer={input}>
			<Stack gap={2} className="-mx-monti-24 mt-auto -mb-monti-20 px-monti-12 pt-monti-12 pb-monti-4">
				<Text variant="micro" tone="subtle" className="px-monti-12 pb-monti-6">
					이 글에서
				</Text>
				<Suggest kind="request">요약 써 줘</Suggest>
				<Suggest kind="request">영어로 옮겨 줘</Suggest>
				<Text variant="micro" tone="subtle" className="px-monti-12 pt-monti-12 pb-monti-6">
					최근
				</Text>
				<Suggest kind="recent">첫 문단을 더 짧게 다듬어 줘</Suggest>
				<Suggest kind="recent">작년 글은 2024 폴더로 옮겨 줘</Suggest>
			</Stack>
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
