import { Edit, OverflowMenuHorizontal } from "@carbon/icons-react";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Button } from "./button";
import { ChatInput } from "./chat-input";
import { ChatMessage } from "./chat-message";
import { DescriptionItem, DescriptionList } from "./description-list";
import { IconButton } from "./icon-button";
import { SidePanel } from "./side-panel";
import { Stack } from "./stack";
import { Suggest } from "./suggest";
import { Text } from "./text";
import { ToolCallLine } from "./tool-call-line";

/**
 * The panel beside a screen (the assistant, a media file, an activity, an entry's properties): cream ground, a line down its left edge, a 60px
 * head with the title (16px bold) and icon buttons at the end, a body, and at the bottom one pill or the box to type in. It does not cover the screen
 * next to it. The width is fixed: 360 (`side`, the default), 300 (`panel`) or 380 (`assistant`). The head leaves its right side free for the ✦
 * button in the corner, except on the assistant.
 */
const meta = {
	title: "Patterns/Sheet/SidePanel",
	component: SidePanel,
	args: { title: "어시스턴트", width: "assistant", corner: false, children: null },
	parameters: { layout: "fullscreen", bleed: true },
	decorators: [
		(Story) => (
			<div className="flex h-svh justify-end">
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof SidePanel>;
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

export const TitleOnly: Story = { render: (args) => <SidePanel {...args}>{null}</SidePanel> };

/** The panel's actions sit before the close button. */
export const Header: Story = {
	render: (args) => (
		<SidePanel
			{...args}
			onClose={() => undefined}
			actions={
				<IconButton label="새 대화" side="bottom">
					<Edit aria-hidden />
				</IconButton>
			}
		>
			{null}
		</SidePanel>
	),
};

/** A media file: name and value rows in the body, a note and one small pill in the foot. */
export const Details: Story = {
	render: (args) => (
		<div className="flex h-svh justify-end">
			<SidePanel
				{...args}
				width="side"
				corner
				title="desk-morning.jpg"
				onClose={() => undefined}
				actions={
					<IconButton label="더 보기" side="bottom">
						<OverflowMenuHorizontal aria-hidden />
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
			</SidePanel>
		</div>
	),
};

/**
 * The assistant's empty panel: no text of its own. The body holds requests to start from, pushed down to just above the input: the group
 * "이 글에서" (saved requests) and "최근" (asked before). The frame's body padding is taken back so the groups sit 12px from the panel's edges and 4px above the input.
 */
export const Empty: Story = {
	render: (args) => (
		<SidePanel {...args} onClose={() => undefined} footer={input}>
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
		</SidePanel>
	),
};

/** A body longer than the panel scrolls, under the head and above the foot. */
export const Scrolling: Story = {
	render: (args) => (
		<SidePanel {...args} onClose={() => undefined} footer={input}>
			{Array.from({ length: 8 }, (_, index) => (
				<div key={index} style={{ display: "contents" }}>
					<ChatMessage author="user">질문 {index + 1}</ChatMessage>
					<ToolCallLine status="done" statusLabel="끝남">
						글 목록 읽음 · 게시글 6편
					</ToolCallLine>
					<ChatMessage>질문 {index + 1}에 대한 답이에요. 패널 안에서 두 줄쯤 이어지도록 조금 길게 썼어요.</ChatMessage>
				</div>
			))}
		</SidePanel>
	),
};

/** The entry's properties: the narrower `panel` width, with the head's right side kept free for ✦. */
export const Properties: Story = {
	render: (args) => (
		<SidePanel {...args} width="panel" corner title="속성" onClose={() => undefined}>
			<DescriptionList>
				<DescriptionItem label="상태">초안</DescriptionItem>
				<DescriptionItem label="주소">
					<Text mono>/posts/first-post</Text>
				</DescriptionItem>
			</DescriptionList>
		</SidePanel>
	),
};

export const NoCloseButton: Story = {
	render: (args) => (
		<SidePanel {...args} footer={<Button size="sm">저장</Button>}>
			{null}
		</SidePanel>
	),
};
