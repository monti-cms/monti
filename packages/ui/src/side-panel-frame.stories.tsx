import type { Meta, StoryObj } from "@storybook/react-vite";
import { Sparkles, SquarePen } from "lucide-react";
import { Button } from "./button";
import { ChatInput } from "./chat-input";
import { ChatMessage } from "./chat-message";
import { IconButton } from "./icon-button";
import { SidePanelFrame } from "./side-panel-frame";
import { Text } from "./text";
import { ToolCallLine } from "./tool-call-line";

const meta = {
	title: "Overlay/SidePanel",
	component: SidePanelFrame,
	args: { title: "Assistant", children: null },
	parameters: { layout: "fullscreen" },
	decorators: [
		(Story) => (
			<div
				style={{
					display: "flex",
					width: 400,
					height: "100svh",
					borderInlineStart: "1px solid var(--monti-border-muted)",
				}}
			>
				<Story />
			</div>
		),
	],
} satisfies Meta<typeof SidePanelFrame>;
export default meta;
type Story = StoryObj<typeof meta>;

const input = (
	<ChatInput
		value=""
		onValueChange={() => undefined}
		onSubmit={() => undefined}
		onStop={() => undefined}
		label="Message"
		placeholder="Ask the assistant…"
		sendLabel="Send"
		stopLabel="Stop"
	/>
);

export const TitleOnly: Story = { render: (args) => <SidePanelFrame {...args}>{null}</SidePanelFrame> };

/** Title, a line under it, the panel's actions and a close button. */
export const Header: Story = {
	render: (args) => (
		<SidePanelFrame
			{...args}
			description="google/gemini-2.5-flash · OpenRouter"
			onClose={() => undefined}
			actions={
				<IconButton label="New conversation" side="bottom">
					<SquarePen aria-hidden />
				</IconButton>
			}
		>
			{null}
		</SidePanelFrame>
	),
};

/** A body that is empty, and a footer that stays at the bottom. */
export const EmptyWithFooter: Story = {
	render: (args) => (
		<SidePanelFrame {...args} onClose={() => undefined} footer={input}>
			<Text tone="muted">
				<Sparkles aria-hidden /> Ask about your site
			</Text>
		</SidePanelFrame>
	),
};

/** A body longer than the panel scrolls, under the header and above the footer. */
export const Scrolling: Story = {
	render: (args) => (
		<SidePanelFrame {...args} onClose={() => undefined} footer={input}>
			{Array.from({ length: 8 }, (_, index) => (
				<div key={index} style={{ display: "contents" }}>
					<ChatMessage author="user">Question {index + 1}</ChatMessage>
					<ToolCallLine status="done" statusLabel="Done">
						Read the post list · 6 posts
					</ToolCallLine>
					<ChatMessage>
						An answer to question {index + 1}, long enough to take a couple of lines in the panel.
					</ChatMessage>
				</div>
			))}
		</SidePanelFrame>
	),
};

export const NoCloseButton: Story = {
	render: (args) => (
		<SidePanelFrame {...args} footer={<Button size="sm">Save</Button>}>
			{null}
		</SidePanelFrame>
	),
};
